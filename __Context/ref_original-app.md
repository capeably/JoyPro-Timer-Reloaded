---
name: ref-original-app
description: "Where the original JoyPro Timer lives and how to check Reloaded against it. Read when porting a feature or checking parity."
type: reference
---

**Original app:** `C:\Users\Adam\Projects\JoyPro Timer App\JoyPro Timer App` (GitHub `capeably/JoyPro-Timer`). Vanilla JS and CSS with no build step; its own `CLAUDE.md` maps its files.

**Live pages:** the original runs at https://capeably.github.io/JoyPro-Timer/ and Reloaded at https://capeably.github.io/JoyPro-Timer-Reloaded/. They share one origin, and so one browser storage: Reloaded's first-run import also brings in anything saved on the original's live page.

**Parity checklist:** [[JoyPro Timer App/JoyPro Timer Reloaded/_Reference/Feature parity|Feature parity]] lists every feature of the original. Reloaded keeps all of them.

**How to apply:**

- Treat the original as read-only reference: never edit or commit there from this project.
- Never write or clear the original's storage (its `joypro_` keys and `joypro_sounds` database), which on the live pages is the original's own data. Nothing in Reloaded may call `localStorage.clear()`.
- When a feature is changed or dropped in Reloaded, record it on the checklist.
