#!/usr/bin/env python3
"""
wall-cast Chromecast scanner

Discovers Chromecasts on the LAN without mDNS:
  1. Derive all /24 subnets from the host ARP/neighbour table
  2. TCP-probe port 8009 (Chromecast CastV2 control port) on every host in
     those subnets (1–254), not just ARP-cached addresses
  3. Fetch the friendly name from the Chromecast's built-in HTTP API (port 8008)

Probing the full subnet (rather than just ARP neighbours) ensures devices that
recently rebooted to a new DHCP address are also found, even before the host
has communicated with them.

Requires network_mode: host so the container shares the host ARP table and
can TCP-probe devices on the LAN directly.

GET /scan  →  [{"name": "Living Room TV", "ip": "192.168.1.42"}, ...]
"""

import concurrent.futures
import json
import socket
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT            = 8765
CHROMECAST_PORT = 8009   # CastV2 control — open on every Chromecast / Google TV
EUREKA_PORT     = 8008   # Built-in HTTP API for device name and info
CONNECT_TIMEOUT = 0.5    # seconds — fast enough for a LAN probe
INFO_TIMEOUT    = 1.0    # seconds — name fetch via HTTP


def arp_neighbours() -> list[str]:
    """Return all IPv4 addresses currently in the host ARP/neighbour cache.

    Reads /proc/net/arp directly — no external tools needed, always available
    on Linux including inside slim Docker containers with network_mode:host.

    File format (header + one row per entry):
        IP address       HW type  Flags  HW address         Mask  Device
        192.168.1.1      0x1      0x2    aa:bb:cc:dd:ee:ff  *     eth0
    """
    try:
        with open("/proc/net/arp") as f:
            lines = f.readlines()[1:]  # skip header
        return [line.split()[0] for line in lines if line.strip()]
    except Exception as exc:
        print(f"[scanner] Could not read ARP table: {exc}", flush=True)
        return []


def subnet_candidates() -> list[str]:
    """Return all host IPs (1–254) in every /24 subnet visible in the ARP table.

    Devices that rebooted to a new DHCP lease won't be in the ARP cache yet,
    but they're still on the same subnet — probing the full range finds them.
    """
    neighbours = arp_neighbours()
    subnets: set[str] = set()
    for ip in neighbours:
        parts = ip.split(".")
        if len(parts) == 4:
            subnets.add(".".join(parts[:3]))

    if not subnets:
        return neighbours  # fallback: use whatever we have

    candidates: list[str] = []
    for subnet in sorted(subnets):
        candidates.extend(f"{subnet}.{i}" for i in range(1, 255))

    return candidates


def chromecast_name(ip: str) -> str | None:
    """Fetch the friendly device name from the Chromecast Eureka HTTP API."""
    try:
        url = f"http://{ip}:{EUREKA_PORT}/setup/eureka_info?params=name"
        with urllib.request.urlopen(url, timeout=INFO_TIMEOUT) as resp:
            data = json.loads(resp.read())
            return data.get("name") or None
    except Exception:
        return None


def probe(ip: str) -> dict | None:
    """Return {name, ip} if port 8009 is open (Chromecast), else None."""
    try:
        with socket.create_connection((ip, CHROMECAST_PORT), timeout=CONNECT_TIMEOUT):
            pass
        name = chromecast_name(ip) or ip
        return {"name": name, "ip": ip}
    except OSError:
        return None


def scan_chromecasts() -> list[dict]:
    candidates = subnet_candidates()
    if not candidates:
        print("[scanner] ARP table is empty — no subnets to probe", flush=True)
        return []

    print(f"[scanner] Probing {len(candidates)} address(es) on port {CHROMECAST_PORT}…", flush=True)
    devices: list[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=64) as executor:
        for result in executor.map(probe, candidates):
            if result:
                devices.append(result)

    devices.sort(key=lambda d: d["ip"])
    print(f"[scanner] Found {len(devices)} Chromecast(s)", flush=True)
    return devices


class ScanHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/scan":
            devices = scan_chromecasts()
            body = json.dumps(devices).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):  # noqa: A002
        pass  # suppress per-request log noise


if __name__ == "__main__":
    # Retry loop: with network_mode:host Docker may restart the container before
    # the previous process has released the port.
    for attempt in range(15):
        try:
            server = HTTPServer(("", PORT), ScanHandler, bind_and_activate=False)
            server.allow_reuse_address = True
            server.server_bind()
            server.server_activate()
            break
        except OSError:
            if attempt < 14:
                print(f"[scanner] Port {PORT} in use, retrying in 2s… ({attempt + 1}/15)", flush=True)
                time.sleep(2)
            else:
                raise

    print(f"[scanner] Listening on :{PORT}", flush=True)
    server.serve_forever()
