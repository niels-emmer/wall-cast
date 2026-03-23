# Prompting a feature into life

wall-cast is fully AI-coded and designed to be extended by prompting. This guide shows you how to structure a feature prompt so Claude can implement a complete, production-ready change — branch, config, UI, widget code, tests, docs, commit, and PR — in a single conversation.

---

## The prompt structure

A good feature prompt has three parts:

```
new feature: <short label>

input: <one or two sentences pointing Claude at the relevant existing code or value>

task:
1. create a feature branch
2. <discover or anchor the current/default value>
3. <persist the setting — where it lives in config>
4. <add the UI control — what kind, where, what range>
5. test, update docs and memory, commit, push and create a PR to main branch
```

That's it. The key insight is the split between **input** (orient Claude in the codebase) and **task** (numbered steps in the right order). Claude will read the relevant code before touching anything, so you don't need to specify file paths.

---

## Why this order works

| Step | Why it comes first |
|------|--------------------|
| Branch first | All changes are isolated; easy to diff and review |
| Discover the current value | Sets the "normal" baseline — Claude reads the code rather than guessing |
| Persist to config | Config is the source of truth; UI and widget code both read from it |
| Add admin UI | Users can change it without editing YAML |
| Widget/display code | Reads the config value; falls back gracefully when the key is absent |
| Test → docs → commit → push → PR | Nothing lands without verification; docs stay in sync |

---

## Real example

Here is the exact prompt that produced the rotator fade speed feature (PR #5, v1.3.0), with identifying details removed:

```
new feature: make fade in/out time selectable

input: you have a parameter somewhere that sets the fade in/out time when
the rotator widget does its thing.

task:
1. create a feature branch
2. get the current value and make this "normal"
3. write this as a setting to the config yaml
4. add a slider to the "general" admin screen for fade speed.
   (slow-normal-fast, 5 steps). Use the "normal" speed from point 1
   and make this "normal" for the slider (middle)
5. test, update docs and memory, commit, push and create a pr to main branch
```

### What Claude did with this

1. **Searched** for the fade transition in `RotatorWidget.tsx` — found `transition: 'opacity 0.8s ease'`
2. **Named** 0.8 s "Normal" and defined five steps: Slow (2.0 s) · Relaxed (1.4 s) · **Normal (0.8 s)** · Snappy (0.4 s) · Fast (0.15 s)
3. **Added** `shared.fade_speed: 0.8` to the backend default config, passed it through the merged API response, and documented it in `wall-cast.example.yaml`
4. **Wired** it to a CSS variable (`--rotator-fade-duration`) set in `App.tsx` so the widget reads it without a prop-drilling chain
5. **Built** a `FadeSpeedSection` component in the admin General tab — a five-step `SegmentedControl` matching the language selector pattern already in use
6. **Tested** by starting a mock backend and screenshotting the admin panel
7. **Updated** `docs/config-reference.md`, committed, pushed, and opened a PR

Total lines changed: 73 insertions, 1 deletion, across 7 files.

---

## Template (copy and adapt)

```
new feature: <name>

input: <one or two sentences — describe the feature in user terms and
hint at where the relevant code or value already exists, e.g. "there is
already a per-widget interval setting in the rotator config">

task:
1. create a feature branch
2. <anchor step — e.g. "find the current hardcoded value and treat it as
   the default">
3. <config step — e.g. "add this as a setting under shared in the YAML">
4. <UI step — e.g. "add a control in the General tab of the admin panel;
   [describe the control type, range, labels, and where it should sit]">
5. test, update docs and memory, commit, push and create a PR to main branch
```

### Adapting step 4

Be specific about the **control type** and **location** — Claude matches existing patterns:

| What you want | What to write |
|---|---|
| Toggle on/off | `add a checkbox in …` |
| Pick from a short list | `add a segmented control with options: X / Y / Z` |
| Numeric slider with named steps | `add a slider (X steps: label–label–label)` |
| Free-form number | `add a number input in …` |
| Per-screen setting | `add this to the Screens tab under the [section] section` |
| Global setting | `add this to the General tab` |

---

## Tips

**Be vague about file paths** — Claude will search the codebase. Describing the feature in user terms ("the fade in the rotator") is better than guessing a file name.

**Anchor to what exists** — asking Claude to "find the current value" before changing anything avoids magic numbers and keeps the default consistent with prior behaviour.

**State the step count and end condition** — ending with "commit, push and create a PR" tells Claude where the task is done. Without this Claude may stop after writing code.

**Follow-up questions are fine** — once the code is merged you can ask "will X happen automatically when the user saves?" and get a direct answer based on the implementation just written. The context window carries the full conversation.

**Trust the stop hooks** — if you have a verification hook configured (e.g. requiring a dev server to be started after edits), Claude will comply before finishing. This catches regressions that a passing TypeScript build alone would miss.

---

## Related guides

- [docs/adding-a-widget.md](adding-a-widget.md) — step-by-step guide for adding a brand-new widget type (new backend router + new React component)
- [docs/widget-style-guide.md](widget-style-guide.md) — design token system; read this before touching widget typography or spacing
- [docs/config-reference.md](config-reference.md) — full YAML field reference; update this whenever you add a config key
