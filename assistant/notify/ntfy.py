"""ntfy notification channel — HTTP POST to a ntfy topic."""

import httpx


def send(
    ntfy_url: str,
    topic: str,
    title: str,
    message: str,
    priority: str = "default",
    tags: list[str] | None = None,
) -> None:
    url = f"{ntfy_url.rstrip('/')}/{topic}"
    headers: dict[str, str] = {
        "Title":        title,
        "Priority":     priority,
        "Content-Type": "text/plain; charset=utf-8",
    }
    if tags:
        headers["Tags"] = ",".join(tags)

    try:
        r = httpx.post(url, content=message.encode("utf-8"), headers=headers, timeout=10.0)
        r.raise_for_status()
        print(f"[assistant] ntfy → {topic}: {title!r}", flush=True)
    except Exception as exc:
        print(f"[assistant] ntfy send failed ({url}): {exc}", flush=True)
