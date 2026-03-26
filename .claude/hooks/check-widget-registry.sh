#!/usr/bin/env bash
# Hook: Widget registry check
# Fires on PostToolUse after Write (new file creation) on widget .tsx files.
#
# When a new *Widget.tsx file is created inside frontend/src/widgets/*/
# this hook verifies the widget is registered in index.ts.
# Unregistered widgets silently do nothing — no error, just absence from
# the available widget list — which is confusing to debug.
#
# See docs/adding-a-widget.md for the 4-step registration guide.

set -uo pipefail

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# Only fire for new widget files: frontend/src/widgets/<dir>/<Name>Widget.tsx
[[ "$FILE" =~ frontend/src/widgets/[^/]+/[A-Z][^/]+Widget\.tsx$ ]] || exit 0
[[ -f "$FILE" ]] || exit 0

REPO_ROOT=$(cd "$(dirname "$FILE")" && git rev-parse --show-toplevel 2>/dev/null) || exit 0
WIDGETS_DIR="$REPO_ROOT/frontend/src/widgets"

WIDGET_FILE=$(basename "$FILE" .tsx)   # e.g. "MyNewWidget"

# Widgets are registered in either index.ts or base-registry.ts (see CLAUDE.md)
if grep -q "$WIDGET_FILE" "$WIDGETS_DIR/index.ts" "$WIDGETS_DIR/base-registry.ts" 2>/dev/null; then
  exit 0
fi

MSG="⚠️  $WIDGET_FILE.tsx was created but is not registered in frontend/src/widgets/index.ts. Follow the 4-step guide in docs/adding-a-widget.md: (1) create widget file ✓ (2) create backend router if needed (3) add to WIDGET_REGISTRY in index.ts (4) add config type to docs/config-reference.md."

jq -n --arg msg "$MSG" '{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": $msg
  }
}'
