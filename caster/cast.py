#!/usr/bin/env python3
"""
wall-cast multi-screen caster

Reads chromecast_ip (and optionally chromecast_name) from each screen in
wall-cast.yaml and casts /?screen=<id> to the corresponding Chromecast.
Re-reads config on every check cycle so adding/removing screens takes
effect without restarting this container.

Dynamic IP recovery
-------------------
When a device is unreachable at its configured IP (e.g. after a reboot that
produced a new DHCP lease), the caster asks the scanner sidecar to scan the
LAN and match the device by chromecast_name.  If found at a new IP the config
is updated in-place (atomic write) so the change persists across restarts and
appears immediately in the admin panel.

Requires chromecast_name to be set per screen (in addition to chromecast_ip).
Without a name the caster still works but cannot auto-recover from IP changes.

Recast signals
--------------
The backend drops a /config/recast-<screen_id>.signal file when the admin
panel's "Re-cast now" button is pressed.  The caster checks for it at the
start of each screen's cycle, removes it, and forces an immediate recast
(bypassing the cooldown).

Per-screen status
-----------------
After each cycle the caster writes /config/caster-status.json with the last
known status of every active screen.  The backend serves this via
GET /api/admin/screens/status.
"""

import json
import os
import re
import socket
import subprocess
import tempfile
import time
import urllib.request

import yaml

CONFIG_PATH    = os.environ.get("WALL_CONFIG_PATH", "/config/wall-cast.yaml")
SERVER_URL     = os.environ.get("SERVER_URL", "http://localhost").rstrip("/")
CHECK_INTERVAL = int(os.environ.get("CHECK_INTERVAL", "60"))
CAST_COOLDOWN  = int(os.environ.get("CAST_COOLDOWN", "300"))  # s before recasting
HEARTBEAT_PATH = os.environ.get("CASTER_HEARTBEAT_PATH", "/config/caster-heartbeat.txt")
SCANNER_URL    = os.environ.get("SCANNER_URL", "http://localhost:8765/scan")

CAST_PORT   = 8009  # CastV2 control port — open on every Chromecast / Google TV
_CONFIG_DIR = os.path.dirname(CONFIG_PATH) or "."
STATUS_FILE = os.path.join(_CONFIG_DIR, "caster-status.json")


def load_screens() -> list[dict]:
    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            cfg = yaml.safe_load(f) or {}
    except Exception as exc:
        print(f"[caster] Config read error: {exc}", flush=True)
        return []

    if not cfg.get("shared", {}).get("casting_enabled", True):
        return []

    result = []
    for screen in cfg.get("screens", []):
        if screen.get("enabled", True) is False:
            continue
        if screen.get("casting_active", True) is False:
            continue
        ip = (screen.get("chromecast_ip") or "").strip()
        if not ip:
            continue
        sid  = screen.get("id", "")
        name = (screen.get("chromecast_name") or "").strip() or None
        result.append({
            "id":   sid,
            "ip":   ip,
            "name": name,
            "url":  f"{SERVER_URL}/?screen={sid}",
        })
    return result


def is_reachable(ip: str) -> bool:
    """TCP probe on the CastV2 port — fast LAN reachability check."""
    try:
        with socket.create_connection((ip, CAST_PORT), timeout=3):
            return True
    except OSError:
        return False


def is_casting(ip: str) -> bool:
    try:
        r = subprocess.run(
            ["catt", "-d", ip, "status"],
            capture_output=True, text=True, timeout=10,
        )
        return bool(re.search(r"DashCast|PLAYING|BUFFERING", r.stdout + r.stderr, re.IGNORECASE))
    except Exception as exc:
        print(f"[caster] Status check failed ({ip}): {exc}", flush=True)
        return False


def cast(ip: str, url: str, sid: str) -> None:
    print(f"[caster] Casting {sid} → {ip}: {url}", flush=True)
    try:
        subprocess.run(["catt", "-d", ip, "cast_site", url], timeout=30)
        print(f"[caster] Cast started: {sid}", flush=True)
    except Exception as exc:
        print(f"[caster] Cast failed ({sid}): {exc} — will retry", flush=True)


def stop_cast(ip: str, sid: str) -> None:
    print(f"[caster] Stopping {sid} ({ip})", flush=True)
    try:
        subprocess.run(["catt", "-d", ip, "stop"], timeout=10)
    except Exception as exc:
        print(f"[caster] Stop failed ({sid}): {exc}", flush=True)


def find_by_name(name: str) -> str | None:
    """Ask the scanner sidecar to scan the LAN and return the IP matching name."""
    try:
        with urllib.request.urlopen(SCANNER_URL, timeout=30) as resp:
            devices: list[dict] = json.loads(resp.read())
        needle = name.strip().lower()
        for d in devices:
            if (d.get("name") or "").strip().lower() == needle:
                return d["ip"]
    except Exception as exc:
        print(f"[caster] Scanner query failed: {exc}", flush=True)
    return None


def update_config_ip(screen_id: str, new_ip: str) -> None:
    """Atomically update chromecast_ip for screen_id in the YAML config."""
    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            cfg = yaml.safe_load(f) or {}

        updated = False
        for screen in cfg.get("screens", []):
            if screen.get("id") == screen_id:
                screen["chromecast_ip"] = new_ip
                updated = True
                break

        if not updated:
            print(f"[caster] Screen {screen_id!r} not found in config — skipping IP update", flush=True)
            return

        yaml_text = yaml.dump(cfg, allow_unicode=True, default_flow_style=False, sort_keys=False)
        fd, tmp_path = tempfile.mkstemp(dir=_CONFIG_DIR, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(yaml_text)
            os.replace(tmp_path, CONFIG_PATH)
        except Exception:
            os.unlink(tmp_path)
            raise

        print(f"[caster] Config updated: {screen_id} IP → {new_ip}", flush=True)

    except Exception as exc:
        print(f"[caster] Config IP update failed ({screen_id}): {exc}", flush=True)


def check_recast_signal(sid: str) -> bool:
    """Return True (and consume the file) if a recast was requested for this screen."""
    path = os.path.join(_CONFIG_DIR, f"recast-{sid}.signal")
    if os.path.exists(path):
        try:
            os.unlink(path)
            print(f"[caster] {sid} recast signal received", flush=True)
        except Exception:
            pass
        return True
    return False


def write_screen_statuses(statuses: dict) -> None:
    """Atomically write per-screen status to caster-status.json."""
    try:
        payload = json.dumps({"updated_at": time.time(), "screens": statuses})
        tmp = STATUS_FILE + ".tmp"
        with open(tmp, "w") as f:
            f.write(payload)
        os.replace(tmp, STATUS_FILE)
    except Exception as exc:
        print(f"[caster] Status file write failed: {exc}", flush=True)


def main() -> None:
    print(
        f"[caster] Starting | config={CONFIG_PATH} base={SERVER_URL} "
        f"interval={CHECK_INTERVAL}s scanner={SCANNER_URL}",
        flush=True,
    )
    print("[caster] Waiting 15s for frontend to be ready...", flush=True)
    time.sleep(15)

    active_ips: set[str] = set()
    last_cast_at: dict[str, float] = {}  # screen id → timestamp of last cast attempt

    while True:
        screens = load_screens()
        current_ips = {s["ip"] for s in screens}

        # Stop sessions for IPs that were removed from config
        for ip in active_ips - current_ips:
            stop_cast(ip, ip)
        active_ips = current_ips

        if not screens:
            print("[caster] No screens with chromecast_ip configured — waiting...", flush=True)

        now = time.time()
        screen_statuses: dict = {}

        for s in screens:
            ip   = s["ip"]
            sid  = s["id"]
            name = s["name"]
            status_str = "unknown"

            force_recast = check_recast_signal(sid)

            if not force_recast and is_casting(ip):
                print(f"[caster] {sid} OK", flush=True)
                status_str = "casting"

            elif not force_recast and now - last_cast_at.get(sid, 0) < CAST_COOLDOWN:
                # catt status can give a false negative right after casting;
                # trust the cast for CAST_COOLDOWN seconds before retrying
                age = int(now - last_cast_at[sid])
                print(f"[caster] {sid} OK (cast {age}s ago)", flush=True)
                status_str = "cooldown"

            elif not force_recast and not is_reachable(ip) and name:
                # Device unreachable at known IP — try to find it at a new IP via scanner
                print(f"[caster] {sid} unreachable at {ip} — scanning for '{name}'…", flush=True)
                status_str = "scanning"
                new_ip = find_by_name(name)
                if new_ip and new_ip != ip:
                    print(f"[caster] {sid} found at new IP {new_ip} (was {ip}) — updating config", flush=True)
                    update_config_ip(sid, new_ip)
                    s["ip"] = new_ip
                    active_ips.discard(ip)
                    active_ips.add(new_ip)
                    cast(new_ip, s["url"], sid)
                    last_cast_at[sid] = now
                    status_str = "starting"
                    ip = new_ip
                elif new_ip == ip:
                    print(f"[caster] {sid} confirmed at {ip} but not responding — may be off", flush=True)
                    status_str = "unreachable"
                else:
                    print(f"[caster] {sid} not found by name '{name}' — will retry next cycle", flush=True)
                    status_str = "unreachable"

            else:
                if force_recast:
                    print(f"[caster] {sid} recast requested — starting", flush=True)
                else:
                    print(f"[caster] {sid} not casting — starting", flush=True)
                status_str = "starting"
                cast(ip, s["url"], sid)
                last_cast_at[sid] = now

            screen_statuses[sid] = {
                "status":       status_str,
                "ip":           ip,
                "last_cast_at": last_cast_at.get(sid, 0),
            }

        write_screen_statuses(screen_statuses)

        # Write heartbeat so the backend landing page can report caster status
        try:
            with open(HEARTBEAT_PATH, "w") as f:
                f.write(str(time.time()))
        except Exception as exc:
            print(f"[caster] Heartbeat write failed: {exc}", flush=True)

        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    main()
