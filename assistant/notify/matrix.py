"""Matrix notification channel — PUT to Matrix Client-Server API (no SDK needed)."""

import time
import uuid

import httpx


def send(
    homeserver: str,
    room_id: str,
    token: str,
    title: str,
    message: str,
) -> None:
    """Send a formatted message to a Matrix room.

    Uses m.room.message with msgtype m.text and a simple HTML body
    combining the title (bold) with the message body.
    """
    base = homeserver.rstrip("/")
    txn_id = f"wc-{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}"
    url = f"{base}/_matrix/client/v3/rooms/{room_id}/send/m.room.message/{txn_id}"

    body_plain = f"{title}\n{message}"
    body_html  = f"<b>{title}</b><br>{message}"

    payload = {
        "msgtype": "m.text",
        "body":    body_plain,
        "format":  "org.matrix.custom.html",
        "formatted_body": body_html,
    }

    try:
        r = httpx.put(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10.0,
        )
        r.raise_for_status()
        print(f"[assistant] matrix → {room_id}: {title!r}", flush=True)
    except Exception as exc:
        print(f"[assistant] matrix send failed ({room_id}): {exc}", flush=True)
