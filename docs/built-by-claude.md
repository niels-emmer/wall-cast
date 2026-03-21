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
