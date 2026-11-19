---
name: feedback-file-protocol
description: "The app must run by opening index.html from disk: no build step, no ES modules. Read before adding a script, library or asset."
type: feedback
---

The app must work when `index.html` is opened straight from disk (`file://`), with no build step and no server.

**Why:** Adam's requirement from the original app, where converting to ES modules was deliberately skipped because module scripts don't load over `file://`.

**How to apply:**

- Plain `<script defer>` files that attach to the global `JP` namespace, listed in dependency order in `index.html`. No `type="module"`, no `import`.
- Don't `fetch()` local files (JSON, SVG, audio): inline the data, and play audio through `new Audio(path)`.
- Third-party code only if it's vendored into the repo as a classic script.
- Test from `file://` as well as from the dev server.
