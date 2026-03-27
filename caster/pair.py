#!/usr/bin/env python3
"""
Interactive pairing script for Android TV Remote (androidtvremote2).

Run once per device to pair wall-cast with your Google TV / Android TV:

    docker compose exec caster python /pair.py --screen-id <id> --ip <ip>

A PIN will appear on your TV screen.  Enter it here to complete pairing.
Certificates are stored in /config/atv-certs/<screen-id>/ and reused by
cast.py for all subsequent wake/sleep commands — no re-pairing needed.

Re-run at any time to re-pair (e.g. after a factory reset) or to verify
an existing pairing.

Example:
    docker compose exec caster python /pair.py --screen-id living-room --ip 192.168.1.42
"""

import argparse
import asyncio
import os
import sys

ATV_CERT_DIR = os.environ.get("ATV_CERT_DIR", "/config/atv-certs")


def cert_paths(screen_id: str) -> tuple[str, str]:
    d = os.path.join(ATV_CERT_DIR, screen_id)
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "cert.pem"), os.path.join(d, "key.pem")


async def pair(screen_id: str, ip: str) -> None:
    try:
        from androidtvremote2 import (  # type: ignore[import]
            AndroidTVRemote,
            CannotConnect,
            ConnectionClosed,
            InvalidAuth,
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
        # Already paired — send a test key to confirm
        print(f"'{screen_id}' is already paired.  Sending KEYCODE_WAKEUP to verify…")
        atv.send_key_command("KEYCODE_WAKEUP")
        print(f"\nOK — '{screen_id}' is paired and responsive.")
        print(f"   Certs: {os.path.dirname(cert)}/")
        atv.disconnect()
        return
    except InvalidAuth:
        pass  # Not yet paired — proceed to PIN flow below
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
        print("The device may have timed out.  Run pair.py again.", file=sys.stderr)
        atv.disconnect()
        sys.exit(1)

    # Verify the pairing by connecting and sending a harmless key
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


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Pair wall-cast with a Google TV / Android TV device.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument(
        "--screen-id",
        required=True,
        help="Screen ID from wall-cast.yaml (e.g. living-room)",
    )
    ap.add_argument(
        "--ip",
        required=True,
        help="IP address of the device (e.g. 192.168.1.42)",
    )
    args = ap.parse_args()
    asyncio.run(pair(args.screen_id, args.ip))


if __name__ == "__main__":
    main()
