#!/usr/bin/env python3
"""
Interactive and non-interactive pairing script for Android TV Remote.

Interactive (manual, one-off):
    docker compose exec caster python /pair.py --screen-id <id> --ip <ip>

    A PIN appears on the TV; enter it in the terminal to complete pairing.

Non-interactive (driven by cast.py / admin panel):
    python /pair.py --non-interactive --screen-id <id> --ip <ip> \\
                    --status-file /config/pair-status-<id>.json \\
                    --pin-file    /config/pair-pin-<id>.json

    Writes JSON status updates to --status-file:
        {"state": "starting"}
        {"state": "waiting_pin"}
        {"state": "success"}
        {"state": "failed", "error": "..."}
    Waits up to 5 min for --pin-file to appear (written by the admin panel).

Certificates are stored in ATV_CERT_DIR/<screen-id>/ (default /config/atv-certs/).
"""

import argparse
import asyncio
import json
import os
import sys

ATV_CERT_DIR = os.environ.get("ATV_CERT_DIR", "/config/atv-certs")
PAIR_PIN_TIMEOUT = int(os.environ.get("PAIR_PIN_TIMEOUT", "300"))  # seconds to wait for PIN


def cert_paths(screen_id: str) -> tuple[str, str]:
    d = os.path.join(ATV_CERT_DIR, screen_id)
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "cert.pem"), os.path.join(d, "key.pem")


def write_status(path: str, payload: dict) -> None:
    try:
        tmp = path + ".tmp"
        with open(tmp, "w") as f:
            json.dump(payload, f)
        os.replace(tmp, path)
    except Exception as exc:
        print(f"[pair] Status write failed: {exc}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Non-interactive mode
# ---------------------------------------------------------------------------

async def pair_noninteractive(
    screen_id: str, ip: str, status_file: str, pin_file: str
) -> None:
    try:
        from androidtvremote2 import (  # type: ignore[import]
            AndroidTVRemote, CannotConnect, ConnectionClosed, InvalidAuth,
        )
    except ImportError:
        write_status(status_file, {"state": "failed", "error": "androidtvremote2 not installed"})
        sys.exit(1)

    cert, key = cert_paths(screen_id)
    atv = AndroidTVRemote("wall-cast", cert, key, ip)

    print(f"[pair:{screen_id}] generating cert…", flush=True)
    write_status(status_file, {"state": "starting"})

    try:
        await atv.async_generate_cert_if_missing()
    except Exception as exc:
        write_status(status_file, {"state": "failed", "error": f"Cert generation failed: {exc}"})
        return

    print(f"[pair:{screen_id}] connecting to {ip}…", flush=True)

    try:
        await atv.async_connect()
        # Device is already paired — verify with a harmless key
        atv.send_key_command("KEYCODE_WAKEUP")
        write_status(status_file, {"state": "success"})
        print(f"[pair:{screen_id}] already paired — verified OK", flush=True)
        atv.disconnect()
        return
    except InvalidAuth:
        pass  # Not yet paired — proceed to PIN flow
    except CannotConnect as exc:
        write_status(status_file, {"state": "failed", "error": f"Cannot reach {ip}: {exc}"})
        print(f"[pair:{screen_id}] cannot connect: {exc}", flush=True)
        return

    print(f"[pair:{screen_id}] starting pairing — PIN will appear on TV", flush=True)
    try:
        await atv.async_start_pairing()
    except CannotConnect as exc:
        write_status(status_file, {"state": "failed", "error": f"Cannot start pairing: {exc}"})
        atv.disconnect()
        return

    write_status(status_file, {"state": "waiting_pin"})
    print(f"[pair:{screen_id}] waiting for PIN (timeout {PAIR_PIN_TIMEOUT}s)…", flush=True)

    # Poll for pin file
    pin: str | None = None
    for _ in range(PAIR_PIN_TIMEOUT):
        if os.path.exists(pin_file):
            try:
                with open(pin_file) as f:
                    data = json.load(f)
                pin = str(data.get("pin", "")).strip()
                os.unlink(pin_file)
            except Exception:
                pass
            if pin:
                break
        await asyncio.sleep(1)

    if not pin:
        write_status(status_file, {"state": "failed", "error": "Timed out waiting for PIN"})
        print(f"[pair:{screen_id}] timed out waiting for PIN", flush=True)
        atv.disconnect()
        return

    print(f"[pair:{screen_id}] PIN received — finishing pairing", flush=True)
    try:
        await atv.async_finish_pairing(pin)
    except InvalidAuth:
        write_status(status_file, {"state": "failed", "error": "Incorrect PIN — try again"})
        print(f"[pair:{screen_id}] incorrect PIN", flush=True)
        atv.disconnect()
        return
    except ConnectionClosed as exc:
        write_status(status_file, {"state": "failed", "error": f"Connection closed: {exc}"})
        print(f"[pair:{screen_id}] connection closed during finish: {exc}", flush=True)
        atv.disconnect()
        return

    # Verify the fresh pairing
    print(f"[pair:{screen_id}] verifying…", flush=True)
    try:
        await atv.async_connect()
        atv.send_key_command("KEYCODE_WAKEUP")
        write_status(status_file, {"state": "success"})
        print(f"[pair:{screen_id}] paired and verified OK", flush=True)
    except Exception as exc:
        # Paired but verify step failed — treat as success anyway
        write_status(status_file, {"state": "success"})
        print(f"[pair:{screen_id}] paired (verify step failed: {exc})", flush=True)
    finally:
        atv.disconnect()


# ---------------------------------------------------------------------------
# Interactive mode
# ---------------------------------------------------------------------------

async def pair_interactive(screen_id: str, ip: str) -> None:
    try:
        from androidtvremote2 import (  # type: ignore[import]
            AndroidTVRemote, CannotConnect, ConnectionClosed, InvalidAuth,
        )
    except ImportError:
        print("androidtvremote2 is not installed.", file=sys.stderr)
        sys.exit(1)

    cert, key = cert_paths(screen_id)
    atv = AndroidTVRemote("wall-cast", cert, key, ip)

    print(f"Generating certificate for '{screen_id}'…")
    await atv.async_generate_cert_if_missing()

    print(f"Connecting to {ip}…")
    try:
        await atv.async_connect()
        print(f"'{screen_id}' is already paired.  Sending KEYCODE_WAKEUP to verify…")
        atv.send_key_command("KEYCODE_WAKEUP")
        print(f"\nOK — '{screen_id}' is paired and responsive.")
        print(f"   Certs: {os.path.dirname(cert)}/")
        atv.disconnect()
        return
    except InvalidAuth:
        pass
    except CannotConnect as exc:
        print(f"\nCannot reach {ip}: {exc}", file=sys.stderr)
        print("Make sure the device is on and connected to the network.", file=sys.stderr)
        sys.exit(1)

    print(f"\nStarting pairing — a PIN will appear on '{screen_id}' (TV screen).")
    print("Keep this terminal open until you have entered the PIN.\n")

    try:
        await atv.async_start_pairing()
    except CannotConnect as exc:
        print(f"Cannot start pairing: {exc}", file=sys.stderr)
        atv.disconnect()
        sys.exit(1)

    pin = input("Enter the PIN shown on the TV: ").strip()
    if not pin:
        print("No PIN entered — aborting.", file=sys.stderr)
        atv.disconnect()
        sys.exit(1)

    try:
        await atv.async_finish_pairing(pin)
    except InvalidAuth:
        print("\nIncorrect PIN.  Run pair.py again and enter the PIN exactly as shown.", file=sys.stderr)
        atv.disconnect()
        sys.exit(1)
    except ConnectionClosed as exc:
        print(f"\nConnection closed during pairing: {exc}", file=sys.stderr)
        atv.disconnect()
        sys.exit(1)

    print("\nPairing complete!  Verifying connection…")
    try:
        await atv.async_connect()
        atv.send_key_command("KEYCODE_WAKEUP")
        print(f"\nOK — '{screen_id}' paired successfully.")
        print(f"   Certs: {os.path.dirname(cert)}/")
        print("\nwall-cast can now wake and sleep this screen via the admin panel.")
    except Exception as exc:
        print(f"\nPaired but verify step failed: {exc}")
        print("This is usually harmless.  Try a wake/sleep from the admin panel.")
    finally:
        atv.disconnect()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(
        description="Pair wall-cast with a Google TV / Android TV device.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--screen-id", required=True, help="Screen ID from wall-cast.yaml")
    ap.add_argument("--ip", required=True, help="IP address of the device")
    ap.add_argument(
        "--non-interactive",
        action="store_true",
        help="Run without user prompts (driven by cast.py / admin panel)",
    )
    ap.add_argument("--status-file", help="Path to write JSON status updates (non-interactive)")
    ap.add_argument("--pin-file", help="Path to poll for the PIN JSON file (non-interactive)")
    args = ap.parse_args()

    if args.non_interactive:
        if not args.status_file or not args.pin_file:
            ap.error("--status-file and --pin-file are required in non-interactive mode")
        asyncio.run(pair_noninteractive(args.screen_id, args.ip, args.status_file, args.pin_file))
    else:
        asyncio.run(pair_interactive(args.screen_id, args.ip))


if __name__ == "__main__":
    main()
