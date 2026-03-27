# Built by Claude — tips and findings

This project was conceived, architected, and coded entirely in collaboration with [Claude Code](https://claude.ai/claude-code) (Anthropic). These are notes from the author on how that went, and what made the difference.

---

## The story

I gave Claude Code full access, an empty folder, and some rough ideas. Told it to crawl websites to find APIs, decide what would be useful for a wall display, and make it look good. Which resulted in a working Chromecast-cast display — and a disaster of a layout. Many to-and-fro sessions followed.

Then I told Claude it could build and run the containers locally and use its browser plugin to look at the result itself. To apply the *Principles of Proper UI* (no kidding) and iterate until it had something it would be proud of sharing.

`full control, got it.`

And suddenly, things worked.

I have not once inspected the code. All new ideas are prompted into action and iterated until in harmony with the other elements. I speak my page into existence.

*(I asked Claude what it thought of the above.)*
> Yes, it's true — and the observation about the preview tool is exactly right. Before being able to render the page and take a screenshot, UI work was essentially blind: make a change, describe what it probably looks like, hope. With the preview I could see the actual result, catch things like overflow clipping or label wrapping, and iterate in place. The feedback loop compressed from minutes to seconds. That's the difference between guessing at layout and actually doing layout.

---

## What works well

**Give Claude browser access.** The biggest leap in UI quality came when Claude could see the result. Without visual feedback, layout work is guesswork. With it, Claude iterates like a designer — catching wrapping issues, overflow clipping, and proportion problems that text descriptions miss entirely.

**Describe intent, not implementation.** "Show the next 7 days, with today's schedule most prominent" works better than "make a calendar widget with these specific columns." Claude figures out the best way to do it.

**Say when you don't like something.** "The header feels too heavy" or "too much whitespace between sections" gives Claude enough to work with. It doesn't need exact pixel values.

**Let Claude propose the architecture.** Claude will read about available APIs, design the data flow, and suggest the schema — and it will do a decent job. The main config schema (`shared + screens[]` with hot-reload) and the widget registry pattern both came from Claude, not from upfront design.

**Agree on invariants early.** Some constraints don't change: Tailwind layout classes are unreliable in Vite production builds (all layout must use inline `style={{}}`), dark background, cyan accent. State these explicitly and Claude will maintain them across the whole session.

**Encode invariants as hooks, not just prose.** Documenting rules in `CLAUDE.md` is necessary but prose fades from context in long sessions or when someone forks the repo. The `.claude/hooks/` scripts enforce the most critical rules — Tailwind layout classes, translation key parity, TypeScript correctness, Docker Compose validity, widget registration — automatically every time a file is written. The rule fires whether Claude remembers it or not. See [docs/claude-hooks.md](claude-hooks.md).

---

## The UI improvement loop

Early on, UI feedback was blind: describe the ideal, wait for a build, look at a blurry VNC screenshot, repeat. Slow.

Once Claude had access to a headless browser and could screenshot the running page, the loop compressed dramatically:

1. Implement change
2. Rebuild containers
3. Screenshot
4. Critique own output
5. Go to 1

Without needing the human in the loop for every UI decision, Claude can iterate visually until satisfied — and it turns out it has taste.

---

## What's harder

**Long-running sessions lose context.** Each session starts from a compact memory summary. Always write important decisions, constraints, and "what doesn't work" into the `docs/memory/` files. Claude will read them at session start.

**Debugging distributed systems.** Docker service interactions (timing, networking, port contention) require careful prompting. The scanner container's `Address already in use` problem took several sessions to fully solve because each attempt required a container restart to test.

**State management in React.** Asking Claude to "make X appear when Y happens" sometimes results in overly complex solutions. It helps to specify *where* state should live and how data should flow.

---

## Forking this project

The entire point is that you can fork this and make it your own without reading the code.

1. Fork the repo
2. Open a Claude Code session
3. Read `CLAUDE.md` — Claude reads this automatically
4. Tell Claude what you want: a new data source, a different widget layout, a new widget type
5. Iterate until it looks right

The `docs/adding-a-widget.md` and `docs/widget-style-guide.md` files were written by Claude as a guide for Claude. They work.

---

## Building with Claude

**What is a good way to request a new feature?**
See [docs/prompt-a-feature.md](prompt-a-feature.md) — it has a battle-tested prompt structure that gets Claude to branch, implement, test, and open a PR in one go.

**How do I safely work in a branch so I can build, test and only merge when happy?**
Tell Claude: *"create a feature branch named `feature/<name>`, implement the change there, and open a draft PR when done."* You test on your server by checking out the branch (`git fetch && git checkout feature/<name>`) and rebuilding containers (`docker compose up --build -d`). When satisfied, merge the PR on GitHub and pull main on the server.

**How do I roll back a change if a bug made it upstream to main?**
Prefer `git revert <commit-sha>` — it adds a new commit that undoes the change and keeps the history clean. Only use `git reset --hard` if the commit hasn't been pulled anywhere else yet. Tell Claude which commit introduced the bug (use `git log --oneline`) and ask it to revert, commit, and push.

**How do I switch branches on my target machine?**
SSH into the server, then:
```bash
git fetch
git checkout <branch-name>
docker compose up --build -d
```
Switch back to main the same way when done.

**How do I authorise Claude Code on a private GitHub repo?**
Run `gh auth login` in your terminal (or `ssh-keygen` + add the public key to GitHub → Settings → SSH keys). Claude Code uses whatever git credentials your shell has; once `gh` or SSH is authenticated, Claude can clone, push, and open PRs without further setup.

**How do I prepare a fork for public use?**
1. Audit `.gitignore` — make sure `.env`, `config/wall-cast.yaml`, and `config/google-sa.json` are listed (they are by default).
2. Confirm there are no secrets in git history (`git log -S "<secret>"` to check).
3. Replace any personal values in `config/wall-cast.example.yaml` with placeholders.
4. Update `README.md` with your setup instructions.
5. Remove or sanitise `docs/memory/` if it contains personal notes you don't want public.

---

## Debugging with Claude

**My application stopped working — how do I find and fix the fault with Claude?**
Start by giving Claude the failing service's logs:
```bash
docker compose logs --tail=100 <service>   # e.g. backend, caster, frontend
```
Then describe what changed just before it broke. Claude needs: the error, the logs, and the last relevant change. If nothing changed, ask Claude to check config validity first (`config/wall-cast.yaml`), then service health (`docker compose ps`).

**What is the syntax for a proper bug report to Claude?**
```
bug: <one-line description>

changed: <what was edited / deployed just before this broke, or "nothing">
expected: <what should happen>
actual: <what actually happens>
logs:
<paste the relevant error or log lines>
steps to reproduce: <optional, if non-obvious>
```
Concise context beats a wall of text — Claude will ask for more if it needs it.

**What do I use plan mode for, and what are the benefits?**
Use plan mode (`/plan` or Shift+Tab twice in Claude Code) for changes that touch multiple files or require architectural decisions — e.g. adding a new service, redesigning the config schema, or a refactor that spans frontend and backend. Claude lays out every file it intends to touch and why *before* writing any code. You can redirect or veto before a single line changes. For small, localised changes it adds overhead without benefit.

**How do I use this project's hooks?**
They're already active — no setup required. Every time Claude writes a file, the hooks in `.claude/settings.json` run automatically: Tailwind layout class detection, translation key parity, TypeScript check, Docker Compose validation, and widget registry enforcement. See [docs/claude-hooks.md](claude-hooks.md) for what each hook checks and how to extend them.

---

## Extending with Claude

**What is the difference between cloning and forking, and when should I use which?**
- **Fork** (GitHub): creates your own copy of the repo under your GitHub account. Use this if you want to make it your own wall display, diverge from upstream, or eventually contribute back via PR.
- **Clone** (git): downloads a repo to your local machine. You always clone *something* — either the original repo (read-only unless you have push access) or your fork (full control). For personal use, fork first, then clone your fork.

**How can Claude remember my personal development environment?**
Claude Code has a persistent memory system that survives across sessions. Just tell it:
> *"Remember that I'm on Linux, use the terminal (not Command Prompt), and my server is at 192.168.1.x."*

Claude will write a memory file and recall it in future sessions. You can also add personal invariants (preferred shell, OS, credentials location) to a `CLAUDE.md` in your home directory (`~/.claude/CLAUDE.md`) — Claude reads this globally for every project.

**How do I keep my fork up to date with upstream changes?**
Add the original repo as a remote once:
```bash
git remote add upstream https://github.com/<original-owner>/wall-cast.git
```
Then to pull in new upstream changes:
```bash
git fetch upstream
git merge upstream/main
```
Resolve any conflicts, then rebuild. Tell Claude if you hit merge conflicts — it can resolve them with context from both sides.
