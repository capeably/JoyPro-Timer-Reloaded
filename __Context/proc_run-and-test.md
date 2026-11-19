---
name: proc-run-and-test
description: "How to run the app and test it without opening windows on Adam's screen. Read before running, previewing or verifying a change."
type: procedure
---

**Read first:**

- **No build, runs from disk** ([[JoyPro Timer App/JoyPro Timer Reloaded/__Context/feedback_file-protocol|feedback_file-protocol]]): open `index.html` directly.
- **Headless by default:** `tests/shoot.js` drives Chrome headless, with no visible window. Ask Adam before anything that opens one (the mini timer window, a visible browser).

**Steps:**

1. Run: open `index.html`. A dev server is in `.claude/launch.json` (`python -m http.server 8094`). Address options: `?lab` adds the Growing Tree lab, `?notour` skips the welcome tour.
2. Logic tests: `node tests/core.test.js` (util, store, engine, actions, migration; Node with a fake clock).
3. Browser checks and screenshots: `node tests/shoot.js` runs every scenario; name some to narrow it (the list is at the top of the file). `flow` presses real keys and checks behavior; `regress` replays the bugs from the first code review, with real mouse clicks; `migrate` seeds the original app's data; `mini` opens the mini timer; `timelapse` renders frames for an animated day; `pots` builds one sheet of six Growing Tree trunks meeting the soil at four stages. Shots land in `_Workbench/_Inbox/shots/`; console errors fail the run.
4. Look at the shots that cover your change before calling it done.
5. After a push, check the live page the same way: set `JP_URL` to https://capeably.github.io/JoyPro-Timer-Reloaded/ and run a few scenarios, such as `themes` and `flow`. GitHub Pages takes a minute or two to update.

**Not covered automatically:** how the mini timer looks floating over other apps, audible chimes and uploaded sounds, mouse drag in the editor, the import and export file dialogs, and Adam's own data coming across from the original. List these for Adam to check by hand.
