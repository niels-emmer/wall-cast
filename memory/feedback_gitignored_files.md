---
name: Remind about manual changes to gitignored files
description: When editing a gitignored file locally, always remind the user to apply the same change manually on the server
type: feedback
---

When a gitignored file is edited (e.g. `.env`, `config/google-sa.json`, any `config/*.json`), always remind the user to apply the same change manually on the server — it won't be pulled via git.

**Why:** User was burned when `.env` was updated locally but the server still had the old value, causing a bug that was hard to trace.

**How to apply:** After editing any gitignored file, add a note like: "Also update this on the server manually — it's gitignored and won't be pulled."
