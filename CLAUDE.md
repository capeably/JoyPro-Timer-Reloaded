# JoyPro Timer Reloaded

A ground-up rebuild of the JoyPro Timer, a focus timer that runs sessions made of timed segments (Set Intentions → Focus Block → Break → … → Wrap Up), with themes, per-segment sounds and a popout mini-timer. The work: interface and interaction design, the timer engine, the themes and their animation, and sound. Vanilla HTML, CSS and JavaScript with no build step.

Context notes live in `__Context/`. This file loads every session; open a note when a task matches its line.

This folder sits inside the Obsidian vault rooted at `C:\Users\Adam\Projects`, so links in these notes are vault-relative wikilinks.

## Rules that bite

- **Never commit or push unless Adam asks.** He decides what reaches git. ([[JoyPro Timer App/JoyPro Timer Reloaded/__Context/feedback_git-push|feedback_git-push]])
- **The app must run by opening `index.html` from disk.** No build step, no ES modules, no `fetch()` of local files. ([[JoyPro Timer App/JoyPro Timer Reloaded/__Context/feedback_file-protocol|feedback_file-protocol]])

## Where to start each task

- **Running, previewing or testing anything:** [[JoyPro Timer App/JoyPro Timer Reloaded/__Context/proc_run-and-test|proc_run-and-test]]: headless checks only; ask before opening windows.
- **Changing the timer, sessions, editing or saving:** [[JoyPro Timer App/JoyPro Timer Reloaded/__Context/ref_architecture|ref_architecture]]: every state change goes through `JP.actions`.
- **Any styling or UI work:** [[JoyPro Timer App/JoyPro Timer Reloaded/__Context/ref_design-system|ref_design-system]], tokens, fonts and the spectrum; timer controls stay quiet at rest ([[JoyPro Timer App/JoyPro Timer Reloaded/__Context/feedback_quiet-controls|feedback_quiet-controls]]).
- **Changing the Growing Tree:** [[JoyPro Timer App/JoyPro Timer Reloaded/__Context/ref_growing-tree|ref_growing-tree]], how the scene works and where to tune it.
- **Changing any other theme's animation:** [[JoyPro Timer App/JoyPro Timer Reloaded/__Context/feedback_animation-scope|feedback_animation-scope]]: only the Growing Tree gets reworked; Starry Night stays as it was.
- **Porting a feature or checking parity with the original:** [[JoyPro Timer App/JoyPro Timer Reloaded/__Context/ref_original-app|ref_original-app]], where the original lives and the parity checklist.

## Where things live

- `index.html`, `css/`, `js/` (`core/`, `ui/`, `scenes/`), `sounds/`, `assets/`: the app.
- `tests/`: Node logic tests and the headless Chrome screenshot and flow runner.
- `__Context/`: the notes this file indexes.
- `_Reference/`: documents for people, such as the feature parity checklist.
- `_Workbench/`: gitignored local scratch space. `_Inbox/` takes the working files of a task in progress (screenshots land in `_Inbox/shots/`); when the task is finished they move to `_Archive/` or wherever they belong.
- `ROADMAP.md`: the task list (see below).
- GitHub: `capeably/JoyPro-Timer-Reloaded`, public, branch `master`. The original stays at `capeably/JoyPro-Timer`.

## Keeping notes

Durable context lives in this file and in `__Context/`, never in auto-memory. The method: the `new-project-setup` skill, `references/context-notes.md`.

- **File a note when something will outlive this conversation:** Adam corrects an approach, a non-obvious fact turns up, a trap would be hit again, or he says "remember this", "from now on" or "I've told you before". Offer the note and its index line; write them when he agrees.
- **Don't file** what expires on its own, what you concluded yourself, or what a note already covers: edit that note instead.
- **One subject per note:** `feedback_` (how to work), `ref_` (what's true), `proc_` (a runbook). The rule first, then **Why:** and **How to apply:**.
- **Every note is reachable,** through this file or an entry note's "Read first" list. Never leave an orphan note or a dead link.
- **Compress on contact,** and retire a stale note to `__Context/_Archive/`, removing its line in the same edit.

## ROADMAP workflow

Living task list: `ROADMAP.md`, in priority order **Now → Next → P1 → P2 → P3 → Someday/Maybe**.

- **Start a task** → add / move it to **Now**.
- **After a push** → remove completed tasks from the ROADMAP (the git commit/push is the completion record), then list the next 1–3 tasks (priority order) so the user knows what's next.
- **User asks to add a task** → default it to **P3** unless they specify a tier.
- **If Next, P1, and P2 are all empty** → prompt the user to prioritize next steps.
