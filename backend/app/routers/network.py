"""
Network status widget backend.

Aggregates five data sources into a single /api/network response:
  1. Router WAN status + host count  — Zyxel VMG8825 DAL API (optional)
  2. External connectivity check      — HTTP probe to 1.1.1.1
  3. DNS server reachability          — TCP probe to 1.1.1.1:53 and 8.8.8.8:53
  4. LAN host count                   — from router lanhosts OID (optional)
  5. Speedtest                         — Cloudflare speed.cloudflare.com (runs async
                                         every 60 s, capped at configurable bytes)

Router config is read from wall-cast.yaml shared.network:
  network:
    router_url:      https://192.168.101.1
    router_username: admin

The router password is read from the environment variable ROUTER_PASSWORD
(set it in .env — never store it in the YAML config).

All five probes are attempted concurrently; partial results are returned if any
individual probe fails. The combined result is cached for 30 s.
"""

import asyncio
import base64
import json
import logging
import os
import ssl
import time
from typing import Any

import httpx

from app import wall_config
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter(tags=["network"])

# ── Cache ─────────────────────────────────────────────────────────────────────
_cache: dict | None = None
_cache_ts: float = 0.0
_CACHE_TTL = 30  # seconds

# ── Speedtest sub-cache ───────────────────────────────────────────────────────
_speedtest: dict | None = None
_speedtest_ts: float = 0.0
_speedtest_running: bool = False
_SPEEDTEST_TTL = 60  # run every 60 s

_SPEEDTEST_DOWN_BYTES_DEFAULT = 2_000_000   # 2 MB
_SPEEDTEST_UP_BYTES_DEFAULT   = 200_000     # 200 KB
_SPEEDTEST_URL_DOWN = "https://speed.cloudflare.com/__down?bytes={n}"
_SPEEDTEST_URL_UP   = "https://speed.cloudflare.com/__up"

# ── Connectivity probe ────────────────────────────────────────────────────────
_PROBE_URLS = ["https://1.1.1.1", "https://8.8.8.8"]
_PROBE_TIMEOUT = 3.0


# ═══════════════════════════════════════════════════════════════════════════════
# Router session — handles Zyxel VMG8825 RSA+AES encrypted DAL API
# ═══════════════════════════════════════════════════════════════════════════════

try:
    from cryptography.hazmat.primitives.asymmetric import padding as asym_padding
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.primitives import padding as sym_padding
    from cryptography.hazmat.backends import default_backend
    _CRYPTO_OK = True
except ImportError:
    _CRYPTO_OK = False
    logger.warning("cryptography package not available — router integration disabled")


def _aes_encrypt(key: bytes, iv: bytes, plaintext: bytes) -> bytes:
    padder = sym_padding.PKCS7(128).padder()
    padded = padder.update(plaintext) + padder.finalize()
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    enc = cipher.encryptor()
    return enc.update(padded) + enc.finalize()


def _aes_decrypt(key: bytes, iv: bytes, ciphertext: bytes) -> bytes:
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    dec = cipher.decryptor()
    padded = dec.update(ciphertext) + dec.finalize()
    unpadder = sym_padding.PKCS7(128).unpadder()
    return unpadder.update(padded) + unpadder.finalize()


class RouterSession:
    """Maintains a single authenticated session to the Zyxel router."""

    def __init__(self, base_url: str, username: str, password: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self._client: httpx.AsyncClient | None = None
        self._aes_key: bytes | None = None
        self._session_key: str | None = None
        self._lock = asyncio.Lock()

    def _make_client(self) -> httpx.AsyncClient:
        # Self-signed cert on router — skip verification
        return httpx.AsyncClient(verify=False, timeout=8.0, follow_redirects=True)

    async def _login(self, client: httpx.AsyncClient) -> None:
        """Perform RSA+AES login, populate self._aes_key and self._session_key."""
        # 1. Get RSA public key
        rsa_resp = await client.get(f"{self.base_url}/getRSAPublickKey")
        rsa_resp.raise_for_status()
        pub_pem = rsa_resp.json()["RSAPublicKey"].encode()
        pub_key = serialization.load_pem_public_key(pub_pem, backend=default_backend())

        # 2. Generate 32-byte AES key + 32-byte IV (CryptoJS style)
        aes_key = os.urandom(32)
        iv_full = os.urandom(32)        # router only uses first 16 as AES IV
        aes_key_b64 = base64.b64encode(aes_key).decode()
        iv_b64 = base64.b64encode(iv_full).decode()

        # 3. RSA-encrypt the base64 string of the AES key (PKCS1v15)
        enc_key_b64 = base64.b64encode(
            pub_key.encrypt(aes_key_b64.encode(), asym_padding.PKCS1v15())
        ).decode()

        # 4. Build and AES-encrypt the credentials payload
        cred = json.dumps({
            "Input_Account": self.username,
            "Input_Passwd": base64.b64encode(self.password.encode()).decode(),
            "currLang": "en",
            "RememberPassword": 0,
            "SHA512_password": False,
        })
        enc_ct = base64.b64encode(
            _aes_encrypt(aes_key, iv_full[:16], cred.encode())
        ).decode()

        # 5. POST /UserLogin
        login_resp = await client.post(
            f"{self.base_url}/UserLogin",
            json={"content": enc_ct, "key": enc_key_b64, "iv": iv_b64},
        )
        login_resp.raise_for_status()
        raw = login_resp.json()
        if "content" not in raw or "iv" not in raw:
            raise RuntimeError(f"Login failed — unexpected response: {raw}")

        # 6. Decrypt response
        resp_iv = base64.b64decode(raw["iv"])[:16]
        resp_ct = base64.b64decode(raw["content"])
        plain = _aes_decrypt(aes_key, resp_iv, resp_ct)
        data = json.loads(plain)
        if data.get("result") != "ZCFG_SUCCESS":
            raise RuntimeError(f"Login failed: {data.get('result')}")

        self._aes_key = aes_key
        self._session_key = data["sessionkey"]
        logger.info("Router login OK — session %s…", self._session_key[:12])

    async def _dal_get(self, oid: str) -> dict:
        """GET /cgi-bin/DAL?oid=X with session cookie + CSRFToken, decrypt response."""
        client = self._client
        assert client is not None and self._session_key and self._aes_key
        resp = await client.get(
            f"{self.base_url}/cgi-bin/DAL",
            params={"oid": oid, "DalGetOneObject": "y"},
            headers={"CSRFToken": self._session_key},
        )
        resp.raise_for_status()
        raw = resp.json()
        if "content" not in raw or "iv" not in raw:
            return raw  # unencrypted error response
        resp_iv = base64.b64decode(raw["iv"])[:16]
        resp_ct = base64.b64decode(raw["content"])
        plain = _aes_decrypt(self._aes_key, resp_iv, resp_ct)
        return json.loads(plain)

    async def query(self, oid: str) -> dict:
        """Query a DAL OID, re-authenticating once if the session has expired."""
        async with self._lock:
            if self._client is None:
                self._client = self._make_client()
            if self._session_key is None:
                await self._login(self._client)

            data = await self._dal_get(oid)
            if data.get("result") == "Invalid Username or Password":
                logger.info("Router session expired — re-logging in")
                await self._login(self._client)
                data = await self._dal_get(oid)
            return data

    async def close(self) -> None:
        async with self._lock:
            if self._client:
                await self._client.aclose()
                self._client = None
                self._session_key = None
                self._aes_key = None


# Module-level router session (recreated when config changes)
_router_session: RouterSession | None = None
_router_cfg_key: str = ""   # tracks last-seen config to detect changes


def _get_router_session() -> RouterSession | None:
    """Return the current router session, (re-)creating it if config changed."""
    global _router_session, _router_cfg_key
    if not _CRYPTO_OK:
        return None
    cfg = wall_config.get_config()
    net_cfg: dict = cfg.get("network", {})
    url = net_cfg.get("router_url", "")
    user = net_cfg.get("router_username", "admin")
    pwd = os.environ.get("ROUTER_PASSWORD", "")
    if not url or not pwd:
        return None
    key = f"{url}:{user}:{pwd}"
    if key != _router_cfg_key:
        _router_cfg_key = key
        _router_session = RouterSession(url, user, pwd)
    return _router_session


# ═══════════════════════════════════════════════════════════════════════════════
# Individual probes
# ═══════════════════════════════════════════════════════════════════════════════

async def _probe_connectivity() -> dict:
    """Try HTTP GET to a reliable host; return ok + latency_ms."""
    for url in _PROBE_URLS:
        try:
            t0 = time.monotonic()
            async with httpx.AsyncClient(timeout=_PROBE_TIMEOUT, verify=False) as c:
                r = await c.get(url)
            latency_ms = round((time.monotonic() - t0) * 1000, 1)
            if r.status_code < 600:
                return {"ok": True, "latency_ms": latency_ms}
        except Exception:
            pass
    return {"ok": False, "latency_ms": None}


async def _probe_router() -> tuple[dict | None, dict | None]:
    """
    Query router DAL API.

    Returns (wan_info, hosts_info) — both None if router not configured or on error.
    """
    session = _get_router_session()
    if session is None:
        return None, None
    try:
        status_task = asyncio.create_task(session.query("cardpage_status"))
        hosts_task  = asyncio.create_task(session.query("lanhosts"))
        status_data, hosts_data = await asyncio.gather(
            status_task, hosts_task, return_exceptions=True
        )

        # --- WAN info ---
        wan_info: dict | None = None
        if isinstance(status_data, dict):
            for obj in status_data.get("Object", []):
                for iface in obj.get("WanLanInfo", []):
                    if (
                        iface.get("X_ZYXEL_Type") == "WAN"
                        and iface.get("Status") == "Up"
                        and iface.get("X_ZYXEL_DefaultGatewayIface")
                    ):
                        ipv4 = iface.get("IPv4Address", [])
                        ip = ipv4[0]["IPAddress"] if ipv4 else None
                        wan_info = {
                            "status": "up",
                            "ip": ip,
                            "link_type": iface.get("LinkType", ""),
                            "service": iface.get("X_ZYXEL_SrvName", ""),
                        }
                        break
                if wan_info:
                    break
            if wan_info is None:
                wan_info = {"status": "down", "ip": None, "link_type": None, "service": None}

        # --- Uptime from status OID (separate call) ---
        try:
            s = await session.query("status")
            for obj in s.get("Object", []):
                uptime = obj.get("DeviceInfo", {}).get("UpTime")
                if uptime is not None and wan_info:
                    wan_info["uptime_s"] = uptime
                    break
        except Exception:
            pass

        # --- Hosts ---
        hosts_info: dict | None = None
        if isinstance(hosts_data, dict):
            raw_hosts = hosts_data.get("Object", [{}])[0].get("lanhosts", [])
            active = [h for h in raw_hosts if h.get("Active")]
            eth_ct = sum(
                1 for h in active
                if "Wi-Fi" not in h.get("X_ZYXEL_ConnectionType", "")
            )
            wifi_ct = len(active) - eth_ct
            hosts_info = {
                "total": len(active),
                "ethernet": eth_ct,
                "wifi": wifi_ct,
            }

        return wan_info, hosts_info

    except Exception as exc:
        logger.error("Router probe error: %s", exc)
        return None, None


# ═══════════════════════════════════════════════════════════════════════════════
# Speedtest — background task
# ═══════════════════════════════════════════════════════════════════════════════

async def _run_speedtest(down_bytes: int, up_bytes: int) -> None:
    global _speedtest, _speedtest_ts, _speedtest_running
    if _speedtest_running:
        return
    _speedtest_running = True
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Download
            down_mbps: float | None = None
            try:
                url = _SPEEDTEST_URL_DOWN.format(n=down_bytes)
                t0 = time.monotonic()
                r = await client.get(url)
                elapsed = time.monotonic() - t0
                received = len(r.content)
                if elapsed > 0:
                    down_mbps = round((received * 8) / (elapsed * 1_000_000), 1)
            except Exception as exc:
                logger.debug("Speedtest download error: %s", exc)

            # Upload
            up_mbps: float | None = None
            try:
                payload = os.urandom(up_bytes)
                t0 = time.monotonic()
                await client.post(_SPEEDTEST_URL_UP, content=payload)
                elapsed = time.monotonic() - t0
                if elapsed > 0:
                    up_mbps = round((up_bytes * 8) / (elapsed * 1_000_000), 1)
            except Exception as exc:
                logger.debug("Speedtest upload error: %s", exc)

        if down_mbps is not None or up_mbps is not None:
            _speedtest = {
                "download_mbps": down_mbps,
                "upload_mbps": up_mbps,
                "tested_at": time.time(),
            }
            _speedtest_ts = time.monotonic()
            logger.info("Speedtest: ↓%.1f ↑%.1f Mbps", down_mbps or 0, up_mbps or 0)

    except Exception as exc:
        logger.error("Speedtest error: %s", exc)
    finally:
        _speedtest_running = False


# ═══════════════════════════════════════════════════════════════════════════════
# Endpoint
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/network")
async def get_network() -> dict[str, Any]:
    global _cache, _cache_ts

    # Trigger speedtest in background if due
    cfg = wall_config.get_config()
    net_cfg: dict = cfg.get("network", {})
    down_bytes = int(net_cfg.get("speedtest_bytes_down", _SPEEDTEST_DOWN_BYTES_DEFAULT))
    up_bytes   = int(net_cfg.get("speedtest_bytes_up",   _SPEEDTEST_UP_BYTES_DEFAULT))

    if (time.monotonic() - _speedtest_ts) > _SPEEDTEST_TTL:
        asyncio.create_task(_run_speedtest(down_bytes, up_bytes))

    # Return cached result if fresh
    if _cache is not None and (time.monotonic() - _cache_ts) < _CACHE_TTL:
        return _cache

    # Run all probes concurrently
    conn_task   = asyncio.create_task(_probe_connectivity())
    router_task = asyncio.create_task(_probe_router())

    conn, (wan, hosts) = await asyncio.gather(
        conn_task, router_task
    )

    result: dict[str, Any] = {
        "wan":          wan,
        "connectivity": conn,
        "hosts":        hosts,
        "speedtest":    _speedtest,
    }
    _cache = result
    _cache_ts = time.monotonic()
    return result
