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

CAST_PORT = 8009  # CastV2 control port — open on every Chromecast / Google TV


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
        config_dir = os.path.dirname(CONFIG_PATH) or "."
        fd, tmp_path = tempfile.mkstemp(dir=config_dir, suffix=".tmp")
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
        for s in screens:
            ip  = s["ip"]
            sid = s["id"]

            if is_casting(ip):
                print(f"[caster] {sid} OK", flush=True)

            elif now - last_cast_at.get(sid, 0) < CAST_COOLDOWN:
                # catt status can give a false negative right after casting;
                # trust the cast for CAST_COOLDOWN seconds before retrying
                age = int(now - last_cast_at[sid])
                print(f"[caster] {sid} OK (cast {age}s ago)", flush=True)

            elif not is_reachable(ip) and s["name"]:
                # Device unreachable at known IP — try to find it at a new IP via scanner
                name = s["name"]
                print(f"[caster] {sid} unreachable at {ip} — scanning for '{name}'…", flush=True)
                new_ip = find_by_name(name)
                if new_ip and new_ip != ip:
                    print(f"[caster] {sid} found at new IP {new_ip} (was {ip}) — updating config", flush=True)
                    update_config_ip(sid, new_ip)
                    s["ip"] = new_ip          # use new IP for this cycle
                    active_ips.discard(ip)
                    active_ips.add(new_ip)
                    cast(new_ip, s["url"], sid)
                    last_cast_at[sid] = now
                elif new_ip == ip:
                    # Scanner confirmed same IP but it's not responding — device is off
                    print(f"[caster] {sid} confirmed at {ip} but not responding — may be off", flush=True)
                else:
                    print(f"[caster] {sid} not found by name '{name}' — will retry next cycle", flush=True)

            else:
                print(f"[caster] {sid} not casting — starting", flush=True)
                cast(ip, s["url"], sid)
                last_cast_at[sid] = now

        # Write heartbeat so the backend landing page can report caster status
        try:
            with open(HEARTBEAT_PATH, "w") as f:
                f.write(str(time.time()))
        except Exception as exc:
            print(f"[caster] Heartbeat write failed: {exc}", flush=True)

        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    main()
