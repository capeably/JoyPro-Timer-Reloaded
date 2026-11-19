---
name: ref-design-system
description: "The visual system: tokens, fonts, the JoyPro spectrum, the two ink families, theme rules. Read before any styling or UI work."
type: reference
---

**Tokens:** `css/tokens.css`, one block per theme (`html[data-theme=…]`). It wins over this note.

- **Type:** Fraunces for the time, segment titles and headings; Instrument Sans for everything else. Each theme tunes Fraunces' weight and its `SOFT`/`WONK` axes through `--clock-wght`, `--clock-soft`, `--clock-wonk`: crisp for Light and Dark, airy for Starry Night, storybook-soft for Growing Tree.
- **Digits** sit in fixed slots as wide as the widest digit (`--digit-w`, measured at runtime), so the clock never jiggles; changing digits roll.
- **The JoyPro spectrum** (`--sp-1` … `--sp-7`, `JP.util.SPECTRUM`) was sampled from the logo. A session's segments take their colors from it in time order, so a finished session paints the whole logo. Spectrum is for data and accents; buttons stay ink.
- **Two ink families:** `--ink*` for text on the page or scene (Growing Tree rewrites it live as the sky darkens) and `--card-ink*` for text on cards (editor, dialogs, menus), which stay steady.
- **Layout:** top bar, stage, and a glass dock holding the ribbon. In Growing Tree the words sit up in the sky and the tree takes the ground.

**How to apply:**

- Use the tokens; don't hard-code colors outside `tokens.css` and the scenes.
- Timer controls stay quiet at rest ([[JoyPro Timer App/JoyPro Timer Reloaded/__Context/feedback_quiet-controls|feedback_quiet-controls]]).
- Size with `min()` alone (never `min()` inside `clamp()`), and give fixed-size flex children `flex-shrink: 0` (Adam's css-flex-overflow skill).
