---
name: ref-architecture
description: "How the code is organized and the one rule for changing state. Read before touching the timer, sessions, editing or persistence."
type: reference
---

All state changes go through `JP.actions` (`js/core/actions.js`). UI code never mutates `JP.store` data directly.

**Why:** the original had three editing surfaces with their own code paths, and its June 2026 audit traced two bugs to them drifting apart. With one door into the data, the stage, ribbon, editor and mini timer can't disagree.

**The layers** (classic scripts on `window.JP`, loaded in order at the bottom of `index.html`):

- `js/core/store.js`: data model, persistence, legacy migration, and the event bus (`JP.store.on/emit`). No DOM, no user rules.
- `js/core/engine.js`: the timer. Wall-clock based, with a Blob worker heartbeat so hidden tabs aren't throttled; auto-advance starts the next segment at the true boundary.
- `js/core/actions.js`: every user operation with its rules (what's locked while running, the clock-edit semantics). Returns `{ ok, reason, message }`; confirmations belong to the UI.
- `js/core/sounds.js`: HTML5 Audio chimes and the IndexedDB Sound Library.
- `js/ui/*`: one file per surface, re-rendering on bus events (`run`, `tick`, `position`, `segments`, `sessions`, `settings`, `complete`, `sounds`).
- `js/scenes/*`: animated themes, registered with `JP.scenes.register`; `js/ui/themes.js` runs them.

**How to apply:**

- A new user action belongs in `actions.js`, with a case in `tests/core.test.js`.
- A big-clock edit sets the segment's length only while `state.started` is false (tracked, and persisted); once the segment has run, it changes only the time left. Don't infer "not started" from `remaining === total`: a mid-segment edit can make them equal.
- Anything confirmed in a dialog must re-check which segment is current when the dialog closes: the timer keeps running behind it.
- Storage keys start `joypro2.`; the original's `joypro_` keys are read once on first run and never written.
- Export files keep the original's format (segment fields `durationMinutes`, `soundEnabled` and so on), so they stay interchangeable.
