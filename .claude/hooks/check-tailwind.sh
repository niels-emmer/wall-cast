#!/usr/bin/env bash
# Hook: Tailwind layout class guard
# Fires on PostToolUse after Edit/Write on any .tsx file.
#
# Layout-critical Tailwind classes silently drop in the Vite production build
# (see CLAUDE.md). This hook catches them the moment they are written so the
# model can replace them with inline style={{}}.
#
# Checks for classes controlling: display/flex, height, overflow, whiteSpace,
# gap, alignItems, justifyContent, minHeight, flex variants, padding, margin.

set -euo pipefail

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

[[ "$FILE" == *.tsx ]] || exit 0
[[ -f "$FILE" ]] || exit 0

# grep -E (POSIX extended) works on both macOS and Linux without extras.
# Patterns cover the layout classes listed in CLAUDE.md.
OFFENDERS=$(grep -nE \
  'className="[^"]*(flex-col|flex-row|flex-1|flex-auto|flex-none|flex-wrap|flex-nowrap| flex |"flex"|'"'"'flex'"'"'|h-full|h-screen|overflow-hidden|overflow-auto|overflow-scroll|overflow-visible|whitespace-nowrap|whitespace-pre|gap-[0-9]|items-center|items-start|items-end|items-stretch|items-baseline|justify-center|justify-between|justify-start|justify-end|justify-around|justify-evenly|min-h-|p-[0-9]|px-[0-9]|py-[0-9]|pt-[0-9]|pb-[0-9]|pl-[0-9]|pr-[0-9]|m-[0-9]|mx-[0-9]|my-[0-9]|mt-[0-9]|mb-[0-9]|ml-[0-9]|mr-[0-9])' \
  "$FILE" 2>/dev/null | head -8) || true

[[ -z "$OFFENDERS" ]] && exit 0

MSG="⚠️  Layout Tailwind classes in $(basename "$FILE") — silently broken in production (CLAUDE.md rule). Replace with inline style={{}} for these properties. Offending lines:
$(echo "$OFFENDERS" | sed 's/^/  /')"

jq -n --arg msg "$MSG" '{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": $msg
  }
}'
