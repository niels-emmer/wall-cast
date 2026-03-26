#!/usr/bin/env bash
# Hook: TypeScript type check  (runs asynchronously — asyncRewake)
# Fires on PostToolUse after Edit/Write on frontend .ts/.tsx files.
#
# Runs tsc --noEmit in the background so editing stays fast.
# If type errors are found the model is woken to address them (exit 2).
# Clean builds exit 0 silently.

set -uo pipefail

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

[[ "$FILE" =~ frontend/src/.*\.(ts|tsx)$ ]] || exit 0
[[ -f "$FILE" ]] || exit 0

REPO_ROOT=$(cd "$(dirname "$FILE")" && git rev-parse --show-toplevel 2>/dev/null) || exit 0

OUTPUT=$(cd "$REPO_ROOT/frontend" && npx tsc --noEmit 2>&1 | head -30)
[[ -z "$OUTPUT" ]] && exit 0

echo "TypeScript errors after editing $(basename "$FILE") — fix before completing the task:"
echo "$OUTPUT"
exit 2
