# Feature parity: original → Reloaded

Every feature of the original JoyPro Timer, as read from its code, and where it lives in Reloaded. A ticked box means it's built and covered by the automated checks (`tests/core.test.js`, `tests/shoot.js`). Items marked *(check by hand)* can't be verified without opening a window or playing sound.

## What changed on purpose

- **One editor.** The session editor (Edit session, or E) replaces the original's inline panel editing, its segment popover and its Edit Session modal. The big clock and the title still edit in place. The original's June 2026 audit traced two bugs to those three overlapping editors.
- **The segment panel became the ribbon:** the whole session at a glance, segments sized by length. Collapsing it still persists. Reordering moved into the editor (drag the grip, or focus it and use the arrow keys).
- **Add segment** makes a 5-minute segment, the old panel's default (the old modal used 25).
- **Jumping to a segment** asks first while the timer runs, as Next always did.
- **Save as** now leaves the original session at its last save; the original app kept the unsaved edits in both sessions.
- **Unsaved changes survive a reload** (the original forgot them).
- **Session names** are unique regardless of capitalization.
- **The mini timer** floats above other windows where the browser supports it (Chrome, Edge), and has play/pause and skip buttons.
- **Added:** the screen stays awake while the timer runs; chimes and auto-advance stay on time in a background tab; the dock shows the time left in the session and when it will end; P opens the mini timer; ? opens help.
- **Storage:** Reloaded keeps its own keys (`joypro2.*`, IndexedDB `joypro2_sounds`) and imports the original's sessions, settings and custom sounds once, on first run, without changing them.

## Timer

- [x] Sessions are named lists of segments; one session is active at a time.
- [x] A segment has a title, a duration (up to 99:59:59), sound on or off, a sound choice, auto-advance, and a theme override.
- [x] Wall-clock timing: true time in a background tab, catching up when the tab returns.
- [x] When a segment ends: its chime plays (if its sound is on and sound isn't muted). After the last segment the completion screen shows; otherwise the next segment loads, starting on its own only if the finished segment has auto-advance on.
- [x] Play/pause (Space).
- [x] Next segment (N): asks to confirm when the current segment is running or part-done, then starts the next one; on the last segment it says so instead.
- [x] Reset (R): asks to confirm when there's progress, then returns to segment 1, paused.
- [x] Clicking a segment (now in the ribbon) jumps to it, paused, at full length.
- [x] The tab title shows the time left and the segment while running, and "Complete!" at the end.
- [x] Time shows as MM:SS, or HH:MM:SS from one hour up.
- [x] Session, segment and time left survive a reload (paused).
- [x] Completion screen: total minutes and segment count, one of the original's six messages, and Start over.

## Editing

- [x] Double-click the time (while paused) to edit hours, minutes and seconds: chevrons with hold-to-repeat that speeds up, mouse wheel in steps of 5 with wrap-around, arrow keys ±1, digits only, Enter saves, Esc cancels, clicking away saves.
- [x] On a segment that hasn't started, that edit sets its duration; mid-segment it changes only the time left (raising the total if needed).
- [x] Double-click the segment title to rename it.
- [x] Per segment, in the editor: rename, change duration, sound on or off, pick a sound, preview it, auto-advance on or off, pick a theme.
- [x] Delete a segment (with a confirm; never the last one).
- [x] Add a segment, straight into renaming it.
- [x] Reorder segments (drag the grip, or arrow keys on it); the active segment stays active. *(check by hand: mouse drag)*
- [x] While running: the active segment's duration can't be edited, and segments can't be added, deleted or reordered.
- [x] Lengths can be typed as `25`, `25:00`, `1:30:00` or `90m`; arrow keys nudge by a minute (Shift: five).
- [x] Saving checks for at least one segment, each at least 1 second, and a unique name.
- [x] Editing keeps your place: changing the current segment's length resets its clock, paused; other edits leave the clock alone.
- [x] New session starts from "New Session" with one 25-minute segment, after asking about unsaved changes.
- [x] Rename the session (in the editor); duplicate names are refused.

## Sessions

- [x] Unsaved changes are tracked against the last save; a dot marks them on the session name.
- [x] Save, Save as (unique name) and Revert in the editor.
- [x] Saved sessions list (All sessions): name, active tag, segment count, total length, and the session's own spectrum strip.
- [x] Click a saved session to load it (asking about unsaved changes first).
- [x] Duplicate a session ("(copy)", "(copy 2)", …), edit it, or delete it with a confirm (never the last; deleting the active one loads the first).
- [x] Unsaved-changes prompt: Cancel, Don't save (revert), Save as, Save.
- [x] Export all sessions to `joypro-sessions.json` (the original's format). *(check by hand: the download)*
- [x] Import sessions from JSON, including the original app's exports: fields are sanitized, sessions whose name already exists are skipped, and a toast reports the counts. *(check by hand: the file picker)*
- [x] Three default sessions: Focus Session (60 min), Focus Session (90 min), Deep Focus (120 min).

## Sound

- [x] Five built-in sounds: Classic Chime (the default), Gentle Bell, Digital Beep, Wooden Block, Singing Bowl. *(check by hand: hearing them)*
- [x] Global mute (M, the top-bar button, and a toast).
- [x] Sound Library: upload MP3 or WAV files, several at once, naming each one. *(check by hand)*
- [x] Storage in IndexedDB (20 MB in all, 2 MB per file, 30 sounds), falling back to localStorage (3 MB, 500 KB, 6 sounds).
- [x] Preview, rename and delete library sounds (delete takes two clicks); segments using a deleted sound fall back to the default. A footer shows usage.
- [x] The Sound Library opens from a button beside every sound picker (no longer an option inside the list, where arrowing through a closed list on Windows triggered it); a custom sound can also be deleted from the editor (two clicks).
- [x] The legacy `joypro_custom_sounds` store and the original's Sound Library are brought across.

## Themes

- [x] Light and Dark (restyled).
- [x] Starry Night: its original animation, unchanged.
- [x] Growing Tree (still the default), reimagined: see `__Context/ref_growing-tree.md`. The tree still regrows for each segment, and the text still changes color to stay readable.
- [x] Theme picker, a global theme, and a per-segment override ("Default" follows the global theme).

## Around the timer

- [x] Top bar: logo, session name, theme, mute, mini timer and help buttons.
- [x] Collapsible segment ribbon; the collapsed state persists.
- [x] Mini timer: segment title, a status dot (pulsing while running), the time, a mini ribbon, play/pause and skip; follows the theme. *(check by hand: it opens a window)*
- [x] Keyboard: Space, N, M, E, R, Esc (closes the topmost thing), plus P and ?; ignored while typing or with a modifier key held; a shortcut hint in the dock.
- [x] First-run welcome tour (four slides, skippable, replayable from Help), a Help dialog, and one-time tips.
- [x] Toast messages.
- [x] The time scales to the window; long titles wrap.
- [x] Controls faded at rest, full on hover and keyboard focus, always full on touch screens.
- [x] Touch support, accessible labels, visible focus rings, and native dialogs with focus trapping and restore.

## Data

- [x] Reloaded's own keys: `joypro2.state`, `joypro2.sessions`, `joypro2.soundLibrary`, `joypro2.onboarded`, `joypro2.hints`; IndexedDB `joypro2_sounds`.
- [x] One-time import of the original's data, including its older shapes (sequences renamed to sessions, sessions to segments). *(check by hand: with your real data)*
