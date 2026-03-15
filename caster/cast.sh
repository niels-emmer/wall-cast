#!/bin/sh
# wall-cast auto-caster
# Casts DISPLAY_URL to the Chromecast at CHROMECAST_IP on startup,
# then polls every CHECK_INTERVAL seconds and re-casts if DashCast is no
# longer the active app (e.g. someone pressed a button on the remote).

set -e

if [ -z "$CHROMECAST_IP" ]; then
  echo "[caster] ERROR: CHROMECAST_IP is not set."
  echo "[caster] Set it in docker-compose.yml or your .env file."
  echo "[caster] Run 'catt scan' on the host to find your Chromecast's IP:"
  echo "[caster]   docker run --rm --network=host python:3.12-slim sh -c 'pip install -q catt && catt scan'"
  exit 1
fi

DISPLAY_URL="${DISPLAY_URL:-http://localhost/}"
CHECK_INTERVAL="${CHECK_INTERVAL:-60}"

echo "[caster] Target: $CHROMECAST_IP -> $DISPLAY_URL"
echo "[caster] Waiting 15s for frontend to be ready..."
sleep 15

cast() {
  echo "[caster] Casting $DISPLAY_URL ..."
  catt -d "$CHROMECAST_IP" cast_site "$DISPLAY_URL" && echo "[caster] Cast started." || echo "[caster] Cast command failed — will retry."
}

cast

echo "[caster] Monitoring every ${CHECK_INTERVAL}s..."
while true; do
  sleep "$CHECK_INTERVAL"
  STATUS=$(catt -d "$CHROMECAST_IP" status 2>&1 || echo "error")
  if echo "$STATUS" | grep -qiE 'DashCast|PLAYING|BUFFERING'; then
    echo "[caster] Active."
  else
    echo "[caster] Cast lost (got: $STATUS). Re-casting..."
    cast
  fi
done
