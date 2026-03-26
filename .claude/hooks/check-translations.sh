#!/usr/bin/env bash
# Hook: Translation parity check
# Fires on PostToolUse after Edit/Write on translations.ts.
#
# Ensures the nl and en objects always have identical top-level keys.
# Any mismatch means a widget will show a missing-translation error in one
# of the two languages, typically discovered late on a real device.

set -euo pipefail

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

[[ "$FILE" == */translations.ts ]] || exit 0
[[ -f "$FILE" ]] || exit 0

RESULT=$(FILE="$FILE" python3 - <<'PYEOF' 2>/dev/null
import re, os
src = open(os.environ['FILE']).read()

def get_keys(name):
    m = re.search(rf'export const {name}: Translations = \{{([\s\S]*?)\n\}}', src)
    if not m:
        return []
    return re.findall(r'^\s{2}(\w+):', m.group(1), re.MULTILINE)

nl = get_keys('nl')
en = get_keys('en')

parts = []
if missing := [k for k in nl if k not in en]:
    parts.append('Missing in en: ' + ', '.join(missing))
if missing := [k for k in en if k not in nl]:
    parts.append('Missing in nl: ' + ', '.join(missing))
if parts:
    print(' | '.join(parts))
PYEOF
)

[[ -z "$RESULT" ]] && exit 0

MSG="⚠️  Translation key mismatch in translations.ts — $RESULT. Both nl and en must define identical keys."

jq -n --arg msg "$MSG" '{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": $msg
  }
}'
