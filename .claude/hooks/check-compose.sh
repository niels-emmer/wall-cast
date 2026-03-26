#!/usr/bin/env bash
# Hook: Docker Compose validation
# Fires on PostToolUse after Edit/Write on docker-compose*.yml files.
#
# Runs `docker compose config` to catch syntax errors, undefined variables,
# and invalid service references before they are pushed and deployed.
# Skips silently if Docker is not running on this machine.

set -uo pipefail

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

[[ "$(basename "$FILE")" =~ ^docker-compose.*\.yml$ ]] || exit 0
[[ -f "$FILE" ]] || exit 0

# Skip gracefully if Docker daemon is not available
command -v docker &>/dev/null || exit 0
docker info &>/dev/null 2>&1 || exit 0

REPO_ROOT=$(cd "$(dirname "$FILE")" && git rev-parse --show-toplevel 2>/dev/null) || exit 0

OUTPUT=$(cd "$REPO_ROOT" && docker compose -f "$FILE" config --quiet 2>&1) && exit 0

MSG="❌  $(basename "$FILE") failed Docker Compose validation — fix before deploying:
$(echo "$OUTPUT" | head -15 | sed 's/^/  /')"

jq -n --arg msg "$MSG" '{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": $msg
  }
}'
