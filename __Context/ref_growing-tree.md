---
name: ref-growing-tree
description: "How the Growing Tree scene works and where to tune it. Read before changing its look, timing or visitors."
type: reference
---

**File:** `js/scenes/growing-tree.js`; its header has a map of its eight sections. The file wins over this note.

Each segment is one storybook day, dawn to starry night, driven by the segment's progress. A new bonsai grows each segment, generated from the segment's id (same segment, same tree; a reload regrows it identically).

- **Progress-driven, repeatable:** the sky and light (the `KEYS` palette, mixed in OKLab), the trunk, branches and pads, blossoms (70–89% of the segment), the moon, stars, fireflies and owl after sunset. Leaf puffs, blossoms and the toadstool pop in with a short time-based spring as their moment passes.
- **Time-driven, alive while paused:** wind sway, clouds, chimney smoke, butterflies by day, a bluebird visit every minute or so, the sun's peek (and a yawn once per golden hour), the moon's z's, shooting stars, falling petals.
- **Segment end:** a spectrum sparkle from the crown, then the old night crossfades into the new dawn; the page's text color switches halfway through.
- **Layout:** the tree is sized between the controls and the dock, so the crown never sits behind the buttons.
- **Planted:** the trunk starts just under the soil's top (`SOIL`, `soilTop`), its foot stands level for the first `FOOT` of its length before following the lean, and the sprout, surface roots and trunk are drawn inside `G.aboveSoil`, a clip that stops at the soil's curve. A square-cut base on a leaning trunk dug into the pot on one side and lifted off the soil on the other (spotted by Adam, November 2026). Moss and the toadstool are drawn after the trunk, in front of its foot.
- **Text color:** the palette's `ink` fields flip quickly at `INK_FLIP`; a slow fade would pass through mid-gray just as the sky does.

**How to apply:**

- Tune colors in `KEYS`, blossom colors in `BLOSSOMS`, growth pacing in `TRUNK_START`, `TRUNK_END` and `REVEAL_POW`.
- Scrub a day in the lab: open `index.html?lab` (`?lab&p=0.8` jumps to 80%). Its buttons summon the bird, the sun's peek and yawn, and a sparkle.
- Trees differ by seed, so check a change on several: `node tests/shoot.js pots` puts six trees' pots and trunk feet at four stages on one sheet.
- Anything new drawn from a tree's seed goes at the end of `buildTree`. Each draw shifts the ones after it, so adding one earlier reshapes every tree, including the one on Adam's screen.
- Respect reduced motion: no sway or visitors, growth still shows.
- Only this animation is being reworked ([[JoyPro Timer App/JoyPro Timer Reloaded/__Context/feedback_animation-scope|feedback_animation-scope]]).
