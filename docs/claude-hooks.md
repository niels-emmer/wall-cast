# Claude Code Hooks

Claude Code has a hooks system that lets you run shell commands automatically at specific points in the coding lifecycle — before or after a tool runs, when Claude finishes responding, when a session starts, and more.

This project ships five hooks in `.claude/settings.json`. They enforce the rules in `CLAUDE.md` automatically, so anyone working in a fork or clone gets the same guardrails without having to remember the rules.

---

## What hooks are

Without hooks, "run the linter after every edit" is a _preference_ — Claude may or may not remember to do it. With a hook it is a _guarantee_ — the shell command runs unconditionally every time the trigger fires, regardless of what Claude is thinking about.

That distinction is why hooks are the right tool for project rules:
- They are deterministic
- They are checked into the repo, so everyone who forks gets them
- They give feedback at the exact moment the violation occurs, not at review time

---

## How they are configured

All hook configuration lives in **`.claude/settings.json`** (committed to git). Each hook entry names a lifecycle event, an optional tool-name matcher, and the command(s) to run:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/my-check.sh"
          }
        ]
      }
    ]
  }
}
```

`$CLAUDE_PROJECT_DIR` is set by Claude Code to the project root. Shell scripts live in `.claude/hooks/` alongside the config.

### Lifecycle events

| Event | When it fires | Typical use |
|-------|--------------|-------------|
| `PostToolUse` | After a tool completes | Lint, validate, check conventions |
| `PreToolUse` | Before a tool runs | Block dangerous operations |
| `Stop` | When Claude finishes responding | Run a full test suite at end of task |
| `SessionStart` | When a session opens | Load project context, print reminders |
| `UserPromptSubmit` | When the user submits a message | Log or rewrite prompts |
| `PreCompact` / `PostCompact` | Around context compaction | Preserve important state |

### Tool matchers

The `matcher` field filters by tool name. `"Edit|Write"` fires on both. Common tools: `Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep`.

### Hook input

Every hook receives a JSON object on stdin describing what happened:

```json
{
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "/path/to/file.tsx",
    "old_string": "...",
    "new_string": "..."
  },
  "tool_response": { "success": true }
}
```

Scripts read this with `jq`:

```bash
FILE=$(cat | jq -r '.tool_input.file_path // empty')
```

### Hook output

A hook can stay silent (exit 0, no output) or return a JSON object:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "Warning text injected into Claude's context"
  }
}
```

`additionalContext` is injected into the model's context window — Claude reads it and can act on it immediately. You can also use `systemMessage` to display a message to the user without injecting it into the model.

To **block** the tool from completing, exit with code 2 and include a reason:

```json
{ "continue": false, "stopReason": "Explanation shown to the model" }
```

### asyncRewake

For slow checks (like a full TypeScript compile), add `"asyncRewake": true` to run the hook in the background. If the command exits 2, Claude is woken and shown the output. If it exits 0, it is silently discarded.

```json
{
  "type": "command",
  "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/check-types.sh",
  "asyncRewake": true,
  "timeout": 60
}
```

---

## The five hooks in this repo

All five hooks fire on `PostToolUse` and produce `additionalContext` warnings rather than hard blocks — the model reads the warning and corrects the violation in the same response.

### 1. Tailwind layout class guard — `check-tailwind.sh`

**Fires on:** `Edit|Write` → `*.tsx`

The Vite production build silently drops layout-critical Tailwind utility classes (see `CLAUDE.md`). This is the hardest mistake to catch because everything looks fine in the dev server. The hook greps for the offending class names in `className` props and injects a warning the moment they are written.

Classes checked: `flex-col`, `flex-row`, `h-full`, `overflow-hidden`, `gap-*`, `items-*`, `justify-*`, `p-*`, `m-*`, and others listed in `CLAUDE.md`.

```bash
# Example warning injected into Claude's context:
⚠️  Layout Tailwind classes in RainWidget.tsx — silently broken in production.
   Replace with inline style={{}}. Offending lines:
     42:    <div className="flex flex-col h-full overflow-hidden gap-4">
```

### 2. Translation parity check — `check-translations.sh`

**Fires on:** `Edit|Write` → `*/translations.ts`

The `nl` and `en` translation objects must always have identical keys. A missing key causes a runtime crash or silent `undefined` in one language. The hook runs a Python script that diffs the top-level keys of both objects and reports any mismatch.

```bash
# Example warning:
⚠️  Translation key mismatch — Missing in en: peakRain.
    Both nl and en must define identical keys.
```

### 3. TypeScript type check — `check-types.sh`

**Fires on:** `Edit|Write` → `frontend/src/**/*.ts` or `.tsx` — runs async

Runs `npx tsc --noEmit` in the background after every frontend file edit. Because it runs async (`asyncRewake: true`), editing is not slowed down. If tsc finds errors it wakes the model with the output so errors are addressed before the task is finished, not discovered later.

### 4. Docker Compose validation — `check-compose.sh`

**Fires on:** `Edit|Write` → `docker-compose*.yml`

Runs `docker compose config --quiet` after every compose file edit. Catches syntax errors, undefined environment variables, and broken service references before they are pushed. Skips gracefully if Docker is not running.

### 5. Widget registry check — `check-widget-registry.sh`

**Fires on:** `Write` (new file creation) → `frontend/src/widgets/**/*Widget.tsx`

An unregistered widget silently does nothing — no error, it just never appears as an option. The hook checks both `index.ts` and `base-registry.ts` for a reference to the new widget file, and points at `docs/adding-a-widget.md` if it is missing.

```bash
# Example warning:
⚠️  SpotifyWidget.tsx was created but is not registered in index.ts.
    Follow the 4-step guide in docs/adding-a-widget.md.
```

---

## Adding your own hook

1. **Write a shell script** in `.claude/hooks/`. Read the file path from stdin with `jq`:

```bash
#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# Skip files that don't match
[[ "$FILE" == *.py ]] || exit 0
[[ -f "$FILE" ]] || exit 0

# Run your check
OUTPUT=$(your-tool "$FILE" 2>&1) && exit 0

# Report the problem
jq -n --arg msg "⚠️  your-tool found issues: $OUTPUT" '{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": $msg
  }
}'
```

2. **Make it executable:**

```bash
chmod +x .claude/hooks/my-check.sh
```

3. **Pipe-test it** before wiring it up — simulate what Claude Code will send:

```bash
echo '{"tool_name":"Edit","tool_input":{"file_path":"/path/to/real/file.py"}}' \
  | .claude/hooks/my-check.sh
```

Confirm the exit code and output are what you expect. A hook that silently exits 0 on every file is worse than no hook.

4. **Register it** in `.claude/settings.json` under the right event and matcher:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/my-check.sh"
          }
        ]
      }
    ]
  }
}
```

5. **Verify** in Claude Code with `/hooks` to confirm the hook appears and is enabled.

---

## Debugging

- **Hook not firing?** Open `/hooks` in Claude Code once — the settings watcher only picks up `.claude/settings.json` if it existed when the session started. Opening `/hooks` forces a reload.
- **Silent failure?** Run the pipe-test manually. Exit code and stdout are the only signals.
- **Wrong files matched?** The `matcher` is a tool name (`Edit`, `Bash`, etc.), not a glob. File extension filtering must be done inside the script.
- **Slow hook blocking editing?** Add `"asyncRewake": true` and `"timeout": 60` to the hook entry.
- **macOS `grep -P` not available?** Use `grep -E` with `[0-9]` instead of `\d`, or use `python3` for complex patterns (see `check-translations.sh` for an example).

---

## Related

- [docs/prompt-a-feature.md](prompt-a-feature.md) — prompting Claude to implement features end-to-end
- [CLAUDE.md](../CLAUDE.md) — the project rules these hooks enforce
- [Claude Code hooks reference](https://docs.anthropic.com/en/docs/claude-code/hooks)
