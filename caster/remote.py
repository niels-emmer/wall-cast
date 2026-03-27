"""
Android TV remote control helpers — wake / sleep.

Uses androidtvremote2 (port 6466, Android TV Remote Service protocol) for
soft-standby devices.  Falls back to Wake-on-LAN for deeper sleep states.

Pairing is a one-time step per device; run pair.py before using wake/sleep:

    docker compose exec caster python /pair.py --screen-id <id> --ip <ip>

Certificates are stored in ATV_CERT_DIR/<screen-id>/ (default /config/atv-certs/)
and reused on every subsequent connection.
"""

import asyncio
import os

ATV_CERT_DIR = os.environ.get("ATV_CERT_DIR", "/config/atv-certs")


def _cert_paths(screen_id: str) -> tuple[str, str]:
    d = os.path.join(ATV_CERT_DIR, screen_id)
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "cert.pem"), os.path.join(d, "key.pem")


def is_paired(screen_id: str) -> bool:
    cert, key = _cert_paths(screen_id)
    return os.path.isfile(cert) and os.path.isfile(key)


async def _send_key_async(ip: str, screen_id: str, keycode: str) -> bool:
    from androidtvremote2 import AndroidTVRemote, CannotConnect, InvalidAuth  # type: ignore[import]

    cert, key = _cert_paths(screen_id)
    atv = AndroidTVRemote("wall-cast", cert, key, ip)
    try:
        await atv.async_generate_cert_if_missing()
        await atv.async_connect()
        atv.send_key_command(keycode)
        return True
    except CannotConnect as exc:
        print(f"[remote] Cannot connect to {screen_id}@{ip}: {exc}", flush=True)
        return False
    except InvalidAuth:
        print(f"[remote] {screen_id} not paired — run pair.py to pair first", flush=True)
        return False
    except Exception as exc:
        print(f"[remote] Key {keycode} failed ({screen_id}@{ip}): {exc}", flush=True)
        return False
    finally:
        atv.disconnect()


def send_key(ip: str, screen_id: str, keycode: str) -> bool:
    """Send a single key command to the Android TV device. Returns True on success."""
    if not is_paired(screen_id):
        print(f"[remote] {screen_id} not paired — skipping key {keycode}", flush=True)
        return False
    try:
        return asyncio.run(_send_key_async(ip, screen_id, keycode))
    except Exception as exc:
        print(f"[remote] asyncio error ({screen_id}): {exc}", flush=True)
        return False


def wake_screen(ip: str, screen_id: str, mac: str | None = None) -> bool:
    """
    Wake the display.

    Primary:  KEYCODE_WAKEUP via Android TV Remote (requires prior pairing).
    Fallback: Wake-on-LAN magic packet (requires chromecast_mac in config).
    """
    if is_paired(screen_id):
        if send_key(ip, screen_id, "KEYCODE_WAKEUP"):
            print(f"[remote] {screen_id} wake sent via ATV remote", flush=True)
            return True
        # ATV remote failed (e.g. device in deeper sleep) — try WoL
        print(f"[remote] {screen_id} ATV remote failed, trying WoL fallback", flush=True)

    if mac:
        try:
            from wakeonlan import send_magic_packet  # type: ignore[import]
            send_magic_packet(mac)
            print(f"[remote] {screen_id} WoL magic packet sent to {mac}", flush=True)
            return True
        except Exception as exc:
            print(f"[remote] {screen_id} WoL failed: {exc}", flush=True)
            return False

    if not is_paired(screen_id):
        print(
            f"[remote] {screen_id} cannot wake: not paired and no chromecast_mac set",
            flush=True,
        )
    return False


def sleep_screen(ip: str, screen_id: str) -> bool:
    """Put the display in standby via KEYCODE_SLEEP (requires prior pairing)."""
    ok = send_key(ip, screen_id, "KEYCODE_SLEEP")
    if ok:
        print(f"[remote] {screen_id} sleep sent", flush=True)
    return ok
