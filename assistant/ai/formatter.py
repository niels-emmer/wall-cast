"""
Optional AI message formatter.

When an AI provider is configured, rewrites template notification messages
into natural language. If AI is unavailable or not configured, falls back
to the original template message — rules still fire normally.

Supported providers:
  none    — no AI, use template as-is (default)
  ollama  — local LLM via Ollama (recommended: llama3.2:3b)
  openai  — OpenAI chat completions (e.g. gpt-4o-mini)
"""

import os

import httpx


def format_message(title: str, message: str, context: str, ai_cfg: dict) -> str:
    """Return a formatted message; falls back to `message` on any error."""
    provider = (ai_cfg.get("provider") or "none").lower()
    if provider == "ollama":
        return _ollama(title, message, context, ai_cfg)
    if provider == "openai":
        return _openai(title, message, context, ai_cfg)
    return message


# ── Prompt ────────────────────────────────────────────────────────────────────

def _prompt(title: str, message: str, context: str) -> str:
    return (
        "Rewrite this home assistant notification as one or two short, friendly, "
        "natural sentences. Keep all specific details (times, names, line numbers, "
        "delays). Do not add information that is not in the original.\n\n"
        f"Title: {title}\n"
        f"Message: {message}\n"
        f"Additional context: {context}\n\n"
        "Rewritten message:"
    )


# ── Ollama ────────────────────────────────────────────────────────────────────

def _ollama(title: str, message: str, context: str, cfg: dict) -> str:
    url   = (cfg.get("ollama_url") or "http://host.docker.internal:11434").rstrip("/")
    model = cfg.get("ollama_model") or "llama3.2:3b"
    try:
        r = httpx.post(
            f"{url}/api/generate",
            json={"model": model, "prompt": _prompt(title, message, context), "stream": False},
            timeout=30.0,
        )
        r.raise_for_status()
        result = (r.json().get("response") or "").strip()
        return result or message
    except Exception as exc:
        print(f"[assistant] Ollama error (falling back to template): {exc}", flush=True)
        return message


# ── OpenAI ────────────────────────────────────────────────────────────────────

def _openai(title: str, message: str, context: str, cfg: dict) -> str:
    api_key = cfg.get("openai_api_key") or os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        print("[assistant] OpenAI configured but no API key found — falling back to template", flush=True)
        return message
    model = cfg.get("openai_model") or "gpt-4o-mini"
    try:
        r = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": model,
                "messages": [{"role": "user", "content": _prompt(title, message, context)}],
                "max_tokens": 150,
            },
            timeout=20.0,
        )
        r.raise_for_status()
        result = (r.json()["choices"][0]["message"]["content"] or "").strip()
        return result or message
    except Exception as exc:
        print(f"[assistant] OpenAI error (falling back to template): {exc}", flush=True)
        return message
