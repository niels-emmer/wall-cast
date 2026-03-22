#!/usr/bin/env python3
"""
wall-cast multi-screen caster

Reads chromecast_ip from each screen in wall-cast.yaml and casts
/?screen=<id> to the corresponding Chromecast. Re-reads config on
every check cycle so adding/removing screens takes effect without
restarting this container.
"""

import os
import re
import subprocess
import time

import yaml

CONFIG_PATH = os.environ.get("WALL_CONFIG_PATH", "/config/wall-cast.yaml")
SERVER_URL = os.environ.get("SERVER_URL", "http://localhost").rstrip("/")
CHECK_INTERVAL  = int(os.environ.get("CHECK_INTERVAL", "60"))
CAST_COOLDOWN   = int(os.environ.get("CAST_COOLDOWN", "300"))  # s before recasting after a successful cast


def load_screens() -> list[dict]:
    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            cfg = yaml.safe_load(f) or {}
    except Exception as exc:
        print(f"[caster] Config read error: {exc}", flush=True)
        return []
    result = []
    for screen in cfg.get("screens", []):
        if screen.get("enabled", True) is False:
            continue
        ip = (screen.get("chromecast_ip") or "").strip()
        if not ip:
            continue
        sid = screen.get("id", "")
        result.append({"id": sid, "ip": ip, "url": f"{SERVER_URL}/?screen={sid}"})
    return result


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


def main() -> None:
    print(
        f"[caster] Starting | config={CONFIG_PATH} base={SERVER_URL} interval={CHECK_INTERVAL}s",
        flush=True,
    )
    print("[caster] Waiting 15s for frontend to be ready...", flush=True)
    time.sleep(15)

    active_ips: set[str] = set()
    last_cast_at: dict[str, float] = {}  # ip → timestamp of last cast attempt

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
            if is_casting(s["ip"]):
                print(f"[caster] {s['id']} OK", flush=True)
            elif now - last_cast_at.get(s["ip"], 0) < CAST_COOLDOWN:
                # catt status can give a false negative right after casting;
                # trust the cast for CAST_COOLDOWN seconds before retrying
                age = int(now - last_cast_at[s["ip"]])
                print(f"[caster] {s['id']} OK (cast {age}s ago)", flush=True)
            else:
                print(f"[caster] {s['id']} not casting — starting", flush=True)
                cast(s["ip"], s["url"], s["id"])
                last_cast_at[s["ip"]] = now

        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    main()
