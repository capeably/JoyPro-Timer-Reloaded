/* ═══════════════════════════════════════════════════════════════
   JoyPro Timer Reloaded · scenes/growing-tree.js
   Growing Tree, reimagined.

   Each segment is one storybook day. At 0% it's dawn and a sprout
   waits in a glazed pot; by the end it's a starry night and a
   bonsai stands in full blossom. Every segment grows its own tree,
   generated from the segment's id, lit from wherever the sun (or
   moon) is. Leaf clusters and blossoms pop into being with a little
   spring as their moment in the segment arrives.

   Visitors, all slow and small so they never pull focus:
     the sun peeks at the tree now and then, and yawns at golden hour
     a bluebird drops by to perch, hop and chirp
     butterflies in the JoyPro colors, a cottage whose window lights
     up at dusk, fireflies, a sleepy moon, an owl, falling petals,
     a toadstool that glows after dark, and a sparkle as each
     segment ends and a new dawn fades in.

   Growth and the sky are driven by the timer's progress (exactly
   repeatable); the visitors run on their own clocks, so the world
   stays alive while the timer is paused. Reduced motion: no sway,
   no visitors, growth still shows.

   Map of this file
     1. The day's palette       5. The bonsai: building it
     2. Helpers                 6. The bonsai: drawing it
     3. The world (landscape)   7. Visitors and effects
     4. Sky, sun and moon       8. The scene (frame loop, vars, debug)
   ═══════════════════════════════════════════════════════════════ */
(function (JP) {
  'use strict';

  const U = JP.util;
  const clamp = U.clamp;
  const lerp = U.lerp;
  const span = U.span;
  const ease = U.ease;
  const TAU = Math.PI * 2;

  /* ═══ 1. The day's palette ═══════════════════════════════════
     Keyframes across the segment, mixed in OKLab. */
  const KEYS = [
    { p: 0, // dawn
      skyTop: '#6C7CC0', skyMid: '#C9A3CF', skyLow: '#FFCFAE', sun: '#FFE2A0', sunGlow: '#FFC58C',
      cloudLit: '#FFE6DE', cloudShade: '#BEA3C6', far: '#A7A4CC', mid: '#8AA58F', near: '#74A561', nearDeep: '#4C7E47', haze: '#F6CBB8',
      leafDark: '#3A7445', leafMid: '#5B9A52', leafLight: '#9DC977', rim: '#FFE0B8', bark: '#8C6448', barkShade: '#573A2A',
      potBody: '#3D5F9E', potRim: '#5F81BF', potShade: '#233C6C', soil: '#4C3527', moss: '#6DA35A', grass: '#6AA25A',
      ink: '#2A2340', ink2: '#4E4566', ink3: '#776E8E', onInk: '#FFF7EE',
      stars: 0.45, light: 0.55, warmth: 0.5, night: 0.15, glass: 0.42 },
    { p: 0.1, // morning
      skyTop: '#4FA0E6', skyMid: '#93CBF2', skyLow: '#E4F1E8', sun: '#FFF2BE', sunGlow: '#FFE9A8',
      cloudLit: '#FFFFFF', cloudShade: '#C6D9EA', far: '#A2C2D8', mid: '#85B27D', near: '#72B05C', nearDeep: '#4C8A45', haze: '#DDEFF6',
      leafDark: '#2E7A3E', leafMid: '#4CA049', leafLight: '#93D06B', rim: '#FFF6CF', bark: '#8B6446', barkShade: '#573B29',
      potBody: '#3A5FA2', potRim: '#5D83C6', potShade: '#213A6E', soil: '#4A3426', moss: '#6CB058', grass: '#6CB25A',
      ink: '#182A1E', ink2: '#3F5446', ink3: '#677A6C', onInk: '#F7FAF2',
      stars: 0, light: 0.6, warmth: 0.15, night: 0, glass: 0.45 },
    { p: 0.45, // midday
      skyTop: '#3A96E8', skyMid: '#79C1F4', skyLow: '#D2EDF9', sun: '#FFF7D0', sunGlow: '#FFF2B4',
      cloudLit: '#FFFFFF', cloudShade: '#BCD3E6', far: '#9BBFD8', mid: '#7EB46E', near: '#6AB254', nearDeep: '#48893E', haze: '#D8EEF8',
      leafDark: '#2B7B39', leafMid: '#45A343', leafLight: '#8DD468', rim: '#FFFBE0', bark: '#8B6446', barkShade: '#573B29',
      potBody: '#3A5FA2', potRim: '#5D83C6', potShade: '#213A6E', soil: '#4A3426', moss: '#6CB058', grass: '#6AB458',
      ink: '#16261A', ink2: '#3D5244', ink3: '#66786A', onInk: '#F7FAF2',
      stars: 0, light: 0.6, warmth: 0.1, night: 0, glass: 0.45 },
    { p: 0.68, // afternoon
      skyTop: '#4694DD', skyMid: '#8AC0EB', skyLow: '#EFE6CA', sun: '#FFE8A0', sunGlow: '#FFD98C',
      cloudLit: '#FFF8EA', cloudShade: '#C8CBD8', far: '#A9B8CA', mid: '#87AE69', near: '#74AB52', nearDeep: '#4E8640', haze: '#F2E7CF',
      leafDark: '#2E7638', leafMid: '#509C40', leafLight: '#A0CC5E', rim: '#FFEFB0', bark: '#8F6546', barkShade: '#593B28',
      potBody: '#3B5EA0', potRim: '#6084C4', potShade: '#223A6C', soil: '#4C3526', moss: '#74AA50', grass: '#74AA52',
      ink: '#1E2618', ink2: '#445238', ink3: '#6B775E', onInk: '#FBF8EE',
      stars: 0, light: 0.7, warmth: 0.35, night: 0, glass: 0.44 },
    { p: 0.8, // golden hour
      skyTop: '#5A7CC6', skyMid: '#E6B47A', skyLow: '#FFD089', sun: '#FFC760', sunGlow: '#FFAE4E',
      cloudLit: '#FFE0AE', cloudShade: '#D69A8C', far: '#C1A69C', mid: '#9E9A58', near: '#8B9E47', nearDeep: '#5E7536', haze: '#FFD49A',
      leafDark: '#3B6C2E', leafMid: '#5E9038', leafLight: '#B5C35C', rim: '#FFD27A', bark: '#9B6A3D', barkShade: '#5E3B24',
      potBody: '#3F5D98', potRim: '#6688C4', potShade: '#243A66', soil: '#503524', moss: '#8A9E46', grass: '#8A9E46',
      ink: '#2B2014', ink2: '#5A4630', ink3: '#7F6A54', onInk: '#FFF6E8',
      stars: 0, light: 0.95, warmth: 1, night: 0.05, glass: 0.4 },
    { p: 0.875, // sunset
      skyTop: '#46489A', skyMid: '#DE7779', skyLow: '#FFA25A', sun: '#FF8C48', sunGlow: '#FF7743',
      cloudLit: '#FFAE8A', cloudShade: '#9A5C80', far: '#9C7696', mid: '#6E6957', near: '#5D6E40', nearDeep: '#3E4D2E', haze: '#FF9E78',
      leafDark: '#2C4C2C', leafMid: '#46653A', leafLight: '#99984E', rim: '#FF9A62', bark: '#6E4A33', barkShade: '#3F2A20',
      potBody: '#2E4A7E', potRim: '#4A6AA6', potShade: '#1B2E52', soil: '#3A281E', moss: '#5E6E3A', grass: '#5E6E40',
      ink: '#2A1820', ink2: '#553844', ink3: '#7A5A66', onInk: '#FFF0EA',
      stars: 0.08, light: 0.8, warmth: 0.85, night: 0.35, glass: 0.36 },
    { p: 0.935, // dusk
      skyTop: '#20265C', skyMid: '#563C7C', skyLow: '#C26879', sun: '#FF6A4A', sunGlow: '#E0605A',
      cloudLit: '#8A6A9C', cloudShade: '#3C3262', far: '#4C446E', mid: '#33404A', near: '#2C4034', nearDeep: '#1C2A22', haze: '#A05C7A',
      leafDark: '#1B3228', leafMid: '#284434', leafLight: '#4C6852', rim: '#C9A8E8', bark: '#3E3030', barkShade: '#241C20',
      potBody: '#22355E', potRim: '#34508A', potShade: '#141F3A', soil: '#241A16', moss: '#2E4430', grass: '#2E4434',
      ink: '#F6EEF2', ink2: '#CDBFD6', ink3: '#A497B2', onInk: '#1C1830',
      stars: 0.65, light: 0.45, warmth: 0.3, night: 0.8, glass: 0.4 },
    { p: 1, // night
      skyTop: '#0A0F2E', skyMid: '#161E48', skyLow: '#2A3866', sun: '#FF6A4A', sunGlow: '#E0605A',
      cloudLit: '#3A4472', cloudShade: '#1B2244', far: '#1E2948', mid: '#172332', near: '#14251D', nearDeep: '#0B1611', haze: '#2E3C6E',
      leafDark: '#0F231F', leafMid: '#183228', leafLight: '#2B4D43', rim: '#A9C6FF', bark: '#2A2430', barkShade: '#16121B',
      potBody: '#1A2A4E', potRim: '#2C4478', potShade: '#0D162E', soil: '#18120F', moss: '#22402C', grass: '#1E3A2A',
      ink: '#F3F0FA', ink2: '#BDBBD8', ink3: '#9896B8', onInk: '#10142E',
      stars: 1, light: 0.5, warmth: 0, night: 1, glass: 0.42 }
  ];
  const NUMS = ['stars', 'light', 'warmth', 'night', 'glass'];
  const COLORS = Object.keys(KEYS[0]).filter(k => k !== 'p' && NUMS.indexOf(k) < 0);
  const KEYS_LAB = KEYS.map(k => {
    const o = { p: k.p };
    COLORS.forEach(f => { o[f] = U.toLab(U.hex(k[f])); });
    NUMS.forEach(f => { o[f] = k[f]; });
    return o;
  });

  function keyPair(p) {
    let i = 0;
    while (i < KEYS_LAB.length - 2 && p > KEYS_LAB[i + 1].p) i++;
    const a = KEYS_LAB[i];
    const b = KEYS_LAB[i + 1];
    return { a, b, t: clamp((p - a.p) / (b.p - a.p), 0, 1) };
  }
  const labAt = (p, f) => { const k = keyPair(p); return U.lerpLab(k.a[f], k.b[f], k.t); };

  /* The text flips from dark to light quickly, while the sky is still bright
     enough for one and already dark enough for the other; a slow fade would
     pass through mid-gray right when the sky is mid-tone too. */
  const INK = ['ink', 'ink2', 'ink3', 'onInk'];
  const INK_FLIP = [0.893, 0.912];

  function paletteAt(p) {
    const { a, b, t } = keyPair(p);
    const out = {};
    COLORS.forEach(f => { out[f] = U.fromLab(U.lerpLab(a[f], b[f], t)); });
    NUMS.forEach(f => { out[f] = lerp(a[f], b[f], t); });
    const flip = U.smoothstep(INK_FLIP[0], INK_FLIP[1], p);
    INK.forEach(f => {
      out[f] = U.fromLab(U.lerpLab(labAt(Math.min(p, INK_FLIP[0]), f), labAt(Math.max(p, INK_FLIP[1]), f), flip));
    });
    return out;
  }

  /* Blossom colors: one per tree, chosen by its seed. */
  const BLOSSOMS = [
    { petal: '#F4A3C2', petal2: '#FAC6DA', heart: '#F4CF5E', weight: 5 },  // sakura
    { petal: '#FFB89A', petal2: '#FFD3BE', heart: '#F6D365', weight: 2 },  // peach
    { petal: '#CFA6EE', petal2: '#E4CDF7', heart: '#F5D76E', weight: 2 },  // lilac
    { petal: '#E5679F', petal2: '#F29BC2', heart: '#FFE08A', weight: 1.5 }, // JoyPro magenta
    { petal: '#F7DCE6', petal2: '#FFF3F7', heart: '#F2C14E', weight: 1 }   // blush white
  ];

  /* ═══ 2. Helpers ════════════════════════════════════════════ */
  const css = U.css;
  const mixRGB = (a, b, t) => [lerp(a[0], b[0], t) | 0, lerp(a[1], b[1], t) | 0, lerp(a[2], b[2], t) | 0];

  /** Catmull-Rom through control points, sampled, with arc length and normals. */
  function spline(points, perSegment) {
    const raw = [];
    const n = points.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(n - 1, i + 2)];
      for (let k = 0; k < perSegment; k++) {
        const t = k / perSegment;
        const t2 = t * t;
        const t3 = t2 * t;
        const f = d => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 +
          (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3);
        raw.push([f(0), f(1)]);
      }
    }
    raw.push(points[n - 1].slice());
    let len = 0;
    const pts = raw.map((q, i) => {
      if (i) len += Math.hypot(q[0] - raw[i - 1][0], q[1] - raw[i - 1][1]);
      return { x: q[0], y: q[1], l: len, nx: 0, ny: 0 };
    });
    pts.forEach((q, i) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const m = Math.hypot(dx, dy) || 1;
      q.nx = -dy / m;
      q.ny = dx / m;
    });
    return { pts, len };
  }

  /** The point at arc length l along a sampled curve. */
  function pointAt(curve, l) {
    const pts = curve.pts;
    if (l <= 0) return pts[0];
    if (l >= curve.len) return pts[pts.length - 1];
    let lo = 0;
    let hi = pts.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (pts[m].l < l) lo = m; else hi = m;
    }
    const a = pts[lo];
    const b = pts[hi];
    const t = (l - a.l) / ((b.l - a.l) || 1);
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), l, nx: lerp(a.nx, b.nx, t), ny: lerp(a.ny, b.ny, t) };
  }

  /** Make an element pop in (time-based spring) once progress passes its birth. */
  function pop(el, p, t, instant, dur) {
    if (p < el.birth) { el.bornAt = null; return 0; }
    if (el.bornAt == null) el.bornAt = instant ? -1e9 : t;
    return ease.spring(clamp((t - el.bornAt) / (dur || 0.75), 0, 1));
  }

  /* ═══ 5. The bonsai: building it ════════════════════════════
     Tree space: the trunk base at (0, 0), y up is negative, and the
     trunk is roughly 0.78 units tall. Drawn at `scale` px per unit. */
  const TRUNK_START = 0.012;
  const TRUNK_END = 0.62;
  const REVEAL_POW = 1.6;
  /* The soil heaped in the pot: a low dome over the rim. The trunk starts
     a little below its top, so the foot is planted rather than perched. */
  const SOIL = { y: -0.008, rx: 0.305, ry: 0.022 };
  const soilTop = x => SOIL.y - SOIL.ry * Math.sqrt(Math.max(0, 1 - (x / SOIL.rx) * (x / SOIL.rx)));
  /* Over this much of its length the trunk's foot turns from standing level
     on the soil to following the lean, so neither side digs into the pot. */
  const FOOT = 0.14;
  const trunkReveal = p => 1 - Math.pow(1 - span(p, TRUNK_START, TRUNK_END), REVEAL_POW);
  /** The progress at which the trunk has grown to fraction f of its length. */
  const revealAt = f => TRUNK_START + (TRUNK_END - TRUNK_START) * (1 - Math.pow(1 - clamp(f, 0, 0.999), 1 / REVEAL_POW));

  function buildTree(seed) {
    const r = U.rng(seed);
    const R = (a, b) => a + (b - a) * r();
    const tree = { branches: [], pads: [], blossoms: [], moss: [] };

    // Blossom color
    const total = BLOSSOMS.reduce((a, b) => a + b.weight, 0);
    let pick = r() * total;
    tree.bloom = BLOSSOMS.find(b => (pick -= b.weight) <= 0) || BLOSSOMS[0];

    // Trunk: an S-curve (informal upright), bending less as it rises
    const height = R(0.74, 0.82);
    const lean = R(-0.07, 0.07);
    const firstSide = r() < 0.5 ? -1 : 1;
    const ctrl = [[0, 0]];
    let side = firstSide;
    for (let k = 1; k <= 4; k++) {
      const t = k / 4;
      const amp = R(0.085, 0.15) * (1 - t * 0.5) * (k === 4 ? 0.35 : 1);
      ctrl.push([lean * t + side * amp, -height * t]);
      side = -side;
    }
    tree.trunk = spline(ctrl, 18);
    const baseHalf = R(0.1, 0.122);
    // m = maturity (0..1): the root flare swells as the tree ages
    tree.trunkHalf = (s, m) => lerp(baseHalf, 0.024, Math.pow(s, 0.72)) * (1 + 0.9 * (m == null ? 1 : m) * Math.exp(-s * 15));
    const top = tree.trunk.pts[tree.trunk.pts.length - 1];

    // Primary branches, alternating sides, lower ones longer
    const slots = [0.3, 0.41, 0.52, 0.62, 0.71, 0.8];
    if (r() < 0.35) slots.splice(1 + Math.floor(r() * 4), 1);
    side = firstSide;
    let repeated = false;
    slots.forEach(f0 => {
      const f = clamp(f0 + R(-0.025, 0.025), 0.22, 0.86);
      const at = pointAt(tree.trunk, f * tree.trunk.len);
      const u = (f - 0.3) / 0.5;
      const len = lerp(0.47, 0.24, clamp(u, 0, 1)) * R(0.86, 1.12);
      const rise = R(0.14, 0.26) * len + 0.02;
      const x0 = at.x;
      const y0 = at.y;
      const pts = [
        [x0, y0],
        [x0 + side * len * 0.34, y0 + 0.03 - len * 0.04],
        [x0 + side * len * 0.68, y0 + 0.012 - len * 0.12],
        [x0 + side * len, y0 - rise]
      ];
      const curve = spline(pts, 10);
      const halfAt = tree.trunkHalf(f) * 0.56;
      const birth = revealAt(f);
      const br = {
        curve, side, f, birth, grow: 0.13,
        half: s => lerp(halfAt, 0.011, Math.pow(s, 0.8)),
        subs: []
      };
      // A side shoot or two near the tip, angled up and out
      const nSubs = r() < 0.55 ? 2 : 1;
      for (let j = 0; j < nSubs; j++) {
        const sf = j === 0 ? R(0.58, 0.72) : R(0.36, 0.48);
        const s0 = pointAt(curve, sf * curve.len);
        const dir = j === 0 ? side : -side * 0.35;
        const sl = len * R(0.26, 0.36);
        const sub = spline([
          [s0.x, s0.y],
          [s0.x + dir * sl * 0.5, s0.y - sl * 0.32],
          [s0.x + dir * sl, s0.y - sl * R(0.55, 0.8)]
        ], 8);
        br.subs.push({
          curve: sub,
          birth: birth + 0.075 + j * 0.02,
          grow: 0.09,
          half: s => lerp(halfAt * 0.5, 0.008, s)
        });
      }
      tree.branches.push(br);

      // Foliage pads: one on the branch tip, smaller ones on the shoots
      const tip = curve.pts[curve.pts.length - 1];
      const w = R(0.15, 0.2) * lerp(1.08, 0.78, clamp(u, 0, 1));
      tree.pads.push(makePad(r, tip.x + side * 0.02, tip.y - 0.035, w, birth + 0.075, side));
      br.subs.forEach((sub, j) => {
        const st = sub.curve.pts[sub.curve.pts.length - 1];
        if (j === 0 || r() < 0.7) tree.pads.push(makePad(r, st.x, st.y - 0.03, R(0.095, 0.13), sub.birth + 0.06, j === 0 ? side : -side));
      });

      // Mostly alternate sides; now and then two in a row, never three
      if (r() < 0.18 && !repeated) repeated = true;
      else { side = -side; repeated = false; }
    });

    // The apex crown
    tree.pads.push(makePad(r, top.x + R(-0.02, 0.02), top.y - 0.045, R(0.2, 0.25), revealAt(0.9), 0, true));
    tree.pads.sort((a, b) => b.cy - a.cy); // draw from the bottom up

    // Blossoms on the upper faces of the pads
    tree.pads.forEach(pad => {
      const n = Math.round(1 + pad.w * 16);
      const upper = pad.puffs.filter(q => q.y < pad.h * 0.1);
      for (let i = 0; i < n && upper.length; i++) {
        const q = upper[Math.floor(r() * upper.length)];
        tree.blossoms.push({
          pad,
          x: q.x + R(-0.5, 0.5) * q.r,
          y: q.y - R(0.2, 0.75) * q.r,
          size: R(0.013, 0.02),
          rot: R(0, TAU),
          alt: r() < 0.22,
          birth: R(0.7, 0.885),
          bornAt: null
        });
      }
    });

    // Moss on the soil, and a toadstool that pops up a third of the way through
    for (let i = 0; i < 11; i++) tree.moss.push({ x: R(-0.27, 0.27), r: R(0.014, 0.03), shade: r() });
    tree.mushroom = { x: (r() < 0.5 ? -1 : 1) * R(0.13, 0.21), size: R(0.85, 1.15), birth: R(0.28, 0.36), bornAt: null };
    tree.sproutLean = R(-0.25, 0.25);
    // Surface roots (nebari), two or three to a side, reaching out over the soil.
    // Drawn last from the seed, so every other part of a tree stays as it was.
    tree.roots = [];
    [-1, 1].forEach(sd => {
      const n = r() < 0.5 ? 2 : 3;
      for (let i = 0; i < n; i++) {
        tree.roots.push({ side: sd, at: R(-0.02, 0.02) + i * 0.012, reach: R(0.07, 0.12) * (1 - i * 0.22), thick: R(0.026, 0.036) * (1 - i * 0.25), hump: R(0.15, 0.45) });
      }
    });
    return tree;
  }

  function makePad(r, cx, cy, w, birth, side, apex) {
    const R = (a, b) => a + (b - a) * r();
    const h = w * R(0.42, 0.5);
    const n = Math.round(9 + w * 72);
    const puffs = [];
    for (let i = 0; i < n; i++) {
      const u = i < 4 ? (i / 3) * 2 - 1 : R(-1, 1);
      const domeTop = -h * Math.sqrt(Math.max(0, 1 - u * u));
      const bottom = h * 0.34;
      const v = i < 4 ? 0.15 : Math.sqrt(r());
      puffs.push({
        x: u * w * 0.9,
        y: lerp(bottom, domeTop, v) * 0.82,
        r: h * R(0.55, 0.86) * (1 - 0.28 * Math.abs(u)),
        leaf: R(0, TAU),
        bornAt: null,
        birth: 0
      });
    }
    // Puffs nearest the branch tip come first.
    puffs.forEach(q => {
      const d = Math.hypot(q.x + side * w * 0.6, q.y - h * 0.4) / (w * 1.8);
      q.birth = birth + clamp(d, 0, 1) * 0.1 + R(0, 0.025);
    });
    return { cx, cy, w, h, puffs, birth, apex: !!apex, phase: R(0, TAU) };
  }

  /* ═══ 8. The scene ══════════════════════════════════════════ */
  JP.scenes.register('growingTree', function (canvas, api) {
    const ctx = canvas.getContext('2d');
    const reduce = api.reducedMotion();
    let W = 0;
    let H = 0;
    let dpr = 1;
    let G = null;           // world geometry for the current size
    let tree = null;
    let treeKey = null;
    let lastP = -1;
    let lastVars = '';
    let snapshot = null;    // last frame of the previous segment, fading out
    let fadeStart = 0;
    let fadeDur = 2.4;
    let started = null;
    let lastT = 0;
    let windNow = 0;
    let pal = null;
    let keyOverride = null; // the dev lab can grow any tree it likes
    const debugState = { progress: null };

    const fx = { petals: [], sparkles: [], smoke: [], zs: [], shoot: null, nextShoot: 0, nextZ: 0, nextSmoke: 0, nextPetal: 0, notes: [] };
    const bird = { state: 'away', next: 0, t0: 0, from: null, to: null, perch: null, hopAt: 0, hop: 0, facing: 1, chirpAt: 0, leaveAt: 0 };
    const owl = { blinkAt: 0, perch: null };
    const face = { next: 0, anim: null, yawned: false };
    const flies = [];
    const butterflies = [];
    let rnd = U.rng(U.hash('joypro-world-' + Date.now()));
    const R = (a, b) => a + (b - a) * rnd();

    /* ═══ 3. The world (landscape) ════════════════════════════ */
    function relayout() {
      const lay = api.layout();
      W = lay.w;
      H = lay.h;
      const dockTop = Math.min(lay.dockTop || H * 0.9, H);
      // The crown stops short of the controls, so they never sit on the leaves.
      const textBottom = lay.textBottom || lay.clockBottom || H * 0.5;
      const margin = Math.max(10, H * 0.016);
      const gap = Math.max(10, H * 0.018);
      // Tree (1.05 units) + pot (0.17 units) between the clock and the dock.
      let scale = (dockTop - margin - textBottom - gap) / 1.24;
      scale = clamp(scale, 84, Math.min(470, W * (W < 640 ? 0.44 : 0.36)));
      const potBottom = dockTop - margin;
      const soilY = potBottom - 0.17 * scale;
      const cx = W / 2;
      const groundY = potBottom - 0.012 * scale;
      const midY = groundY - Math.max(40, H * 0.085);
      const farY = midY - Math.max(26, H * 0.055);

      const wr = U.rng(U.hash('joypro-landscape'));
      const WR = (a, b) => a + (b - a) * wr();
      const ridge = (base, amps) => {
        const phases = amps.map(() => WR(0, TAU));
        const freqs = amps.map((_, i) => WR(0.7, 1.3) * (i + 1) * 1.15);
        const step = 6;
        const ys = [];
        for (let x = 0; x <= W + step; x += step) {
          let y = base;
          amps.forEach((a, i) => { y += a * Math.sin((x / Math.max(W, 1)) * TAU * freqs[i] * 0.5 + phases[i]); });
          ys.push(y);
        }
        return { ys, step, at: x => ys[clamp(Math.round(x / step), 0, ys.length - 1)] };
      };
      const far = ridge(farY, [H * 0.022, H * 0.012, H * 0.006]);
      const mid = ridge(midY, [H * 0.016, H * 0.01]);
      // The near knoll rises gently under the pot.
      const nearYs = [];
      const step = 6;
      for (let x = 0; x <= W + step; x += step) {
        const d = (x - cx) / Math.max(W * 0.3, scale * 0.9);
        nearYs.push(groundY + (1 - Math.exp(-d * d)) * Math.max(18, H * 0.05) + Math.sin(x / 57) * 1.5);
      }
      const near = { ys: nearYs, step, at: x => nearYs[clamp(Math.round(x / step), 0, nearYs.length - 1)] };

      const toPath = rd => {
        const p = new Path2D();
        p.moveTo(0, rd.ys[0]);
        rd.ys.forEach((y, i) => p.lineTo(i * rd.step, y));
        p.lineTo(W, H);
        p.lineTo(0, H);
        p.closePath();
        return p;
      };

      // Little round trees on the far hills, clear of the middle
      const farTrees = [];
      for (let i = 0; i < 16; i++) {
        const x = WR(0, W);
        if (Math.abs(x - cx) < scale * 1.1) continue;
        farTrees.push({ x, r: WR(3, 6.5) * clamp(W / 1400, 0.7, 1.2), lean: WR(-0.1, 0.1) });
      }

      // A cottage on the middle hill, away from the tree
      const cw = clamp(W * 0.022, 15, 30);
      let cottageX = W * 0.83;
      if (cottageX - cw < cx + scale * 0.95) cottageX = Math.min(W - cw * 1.6, cx + scale * 0.95 + cw * 1.4);
      const cottage = cottageX + cw < W - 4 ? { x: cottageX, w: cw, y: mid.at(cottageX) + cw * 0.12 } : null;

      // Stars (fixed for the size), a few with a sparkle
      const stars = [];
      const count = Math.floor((W * H) / 5200);
      for (let i = 0; i < count; i++) {
        stars.push({ x: WR(0, W), y: WR(0, farY - 10), r: WR(0.4, 1.35), tw: WR(0.6, 2.2), ph: WR(0, TAU), big: wr() < 0.07 });
      }

      // Clouds in two layers: a soft flat base with a billowing top
      const clouds = [];
      const nClouds = Math.round(clamp(W / 260, 3, 6));
      for (let i = 0; i < nClouds; i++) {
        const nearLayer = i % 3 === 0;
        const size = clamp(W / 12, 64, 140) * WR(0.75, 1.2) * (nearLayer ? 1.15 : 0.85);
        const puffs = [];
        const base = 4 + Math.floor(wr() * 2);
        for (let k = 0; k < base; k++) {
          const u = (k / (base - 1)) * 2 - 1;
          const rr = size * WR(0.17, 0.22) * (1 - 0.25 * Math.abs(u));
          puffs.push({ x: u * size * 0.36, y: -rr * 0.85, r: rr });
        }
        const tops = 2 + Math.floor(wr() * 2);
        for (let k = 0; k < tops; k++) {
          const rr = size * WR(0.21, 0.29);
          puffs.push({ x: WR(-0.2, 0.2) * size, y: -rr * 0.9 - size * WR(0.07, 0.15), r: rr, top: true });
        }
        clouds.push({
          x: WR(-0.1, 1.1) * W,
          y: WR(0.12, 0.4) * farY + size * 0.2,
          size,
          base: { w: size * 0.9, h: size * 0.17 },
          speed: nearLayer ? WR(8, 13) : WR(4, 7.5),
          alpha: nearLayer ? 0.96 : 0.82,
          puffs,
          near: nearLayer
        });
      }

      // Grass tufts and JoyPro-colored wildflowers along the knoll's crest
      const tufts = [];
      const flowers = [];
      for (let x = WR(0, 14); x < W; x += WR(10, 22)) {
        tufts.push({ x, n: 2 + Math.floor(wr() * 3), len: WR(6, 13), lean: WR(-0.3, 0.3) });
      }
      for (let i = 0; i < Math.round(W / 70); i++) {
        const x = WR(0, W);
        if (Math.abs(x - cx) < scale * 0.42) continue;
        flowers.push({ x, h: WR(9, 18), c: U.hex(U.SPECTRUM[Math.floor(wr() * U.SPECTRUM.length)]), r: WR(2.4, 3.6), ph: WR(0, TAU) });
      }

      // Everything above the soil and the rim. The trunk's foot and roots are drawn
      // inside it, so they meet the soil along its curve; a pixel low, to hide the seam.
      const aboveSoil = new Path2D();
      const rimTop = soilY - 0.012 * scale;
      aboveSoil.moveTo(0, -H);
      aboveSoil.lineTo(W, -H);
      aboveSoil.lineTo(W, rimTop);
      aboveSoil.lineTo(cx + SOIL.rx * scale, rimTop);
      aboveSoil.ellipse(cx, soilY + SOIL.y * scale + 1, SOIL.rx * scale, SOIL.ry * scale, 0, 0, Math.PI, true);
      aboveSoil.lineTo(0, rimTop);
      aboveSoil.closePath();

      G = { scale, cx, soilY, potBottom, groundY, dockTop, textBottom, far, mid, near, farY, aboveSoil,
        farPath: toPath(far), midPath: toPath(mid), nearPath: toPath(near),
        farTrees, cottage, stars, clouds, tufts, flowers,
        sunR: clamp(Math.min(W, H) * 0.045, 22, 46),
        // High noon sits up under the top bar, clear of the title and the time.
        peakY: Math.max(clamp(Math.min(W, H) * 0.045, 22, 46) + 26, H * 0.07) };

      // Visitors that need the layout
      butterflies.length = 0;
      const nb = W < 600 ? 1 : 2;
      for (let i = 0; i < nb; i++) {
        butterflies.push({
          rx: scale * R(0.6, 1.0), ry: scale * R(0.22, 0.36),
          f: [R(0.25, 0.4), R(0.8, 1.1), R(0.35, 0.55), R(1.4, 1.9)],
          ph: [R(0, TAU), R(0, TAU), R(0, TAU), R(0, TAU)],
          c: U.hex([U.SPECTRUM[0], U.SPECTRUM[3], U.SPECTRUM[5], U.SPECTRUM[2]][(i * 2 + Math.floor(R(0, 2))) % 4]),
          size: clamp(scale * 0.06, 8, 16),
          prevX: 0
        });
      }
      flies.length = 0;
      const nf = Math.round(clamp(W / 110, 6, 14));
      for (let i = 0; i < nf; i++) {
        flies.push({
          x: cx + R(-1, 1) * (scale * 1.1 + W * 0.12),
          y: lerp(soilY - scale * 0.95, groundY + 6, R(0, 1)),
          ax: R(18, 46), ay: R(10, 26), f1: R(0.12, 0.3), f2: R(0.16, 0.34), ph: R(0, TAU), blink: R(0.5, 1.4), size: R(0.8, 1.25)
        });
      }
    }

    /* Tree space → screen, with the wind's sway growing toward the top. */
    const SWAY = 0.016;
    const sx = (x, y) => G.cx + x * G.scale + windNow * SWAY * G.scale * Math.pow(Math.max(0, -y), 1.5);
    const sy = y => G.soilY + y * G.scale;

    /* ═══ 4. Sky, sun and moon ════════════════════════════════ */
    function drawSky(c) {
      const g = ctx.createLinearGradient(0, 0, 0, G.groundY);
      g.addColorStop(0, css(c.skyTop));
      g.addColorStop(0.55, css(c.skyMid));
      g.addColorStop(1, css(c.skyLow));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    function sunPos(p) {
      const u = clamp(p / 0.92, 0, 1);
      const horizon = G.farY;
      const x = lerp(W * 0.04, W * 0.96, u);
      // A flattened arc: the sun spends the day high and wide, around the words.
      let y = horizon - (horizon - G.peakY) * Math.pow(Math.sin(Math.PI * u), 0.6) + G.sunR * 0.35;
      if (p > 0.92) y += span(p, 0.92, 1, ease.inOutSine) * G.sunR * 2.6;
      return { x, y };
    }

    function moonPos(p) {
      const v = span(p, 0.86, 1);
      return {
        x: lerp(W * 0.1, W * 0.17, v),
        y: lerp(G.farY + G.sunR, Math.max(G.sunR + 76, H * 0.17), ease.outCubic(v)),
        a: span(p, 0.86, 0.93)
      };
    }

    function drawStars(c, t) {
      if (c.stars < 0.02) return;
      for (const s of G.stars) {
        const tw = 0.55 + 0.45 * Math.sin(t * s.tw + s.ph);
        const a = c.stars * tw * 0.9;
        if (a < 0.03) continue;
        ctx.fillStyle = 'rgba(255,252,236,' + a.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fill();
        if (s.big && a > 0.3) {
          ctx.strokeStyle = 'rgba(255,252,236,' + (a * 0.5).toFixed(3) + ')';
          ctx.lineWidth = 0.8;
          const k = s.r * 4.5 * tw;
          ctx.beginPath();
          ctx.moveTo(s.x - k, s.y); ctx.lineTo(s.x + k, s.y);
          ctx.moveTo(s.x, s.y - k); ctx.lineTo(s.x, s.y + k);
          ctx.stroke();
        }
      }
      // An occasional shooting star, gentler than Starry Night's
      if (!reduce && c.stars > 0.7) {
        if (!fx.nextShoot) fx.nextShoot = t + R(6, 14);
        if (!fx.shoot && t > fx.nextShoot) {
          const x0 = R(0.15, 0.85) * W;
          fx.shoot = { t0: t, x0, y0: R(0.06, 0.3) * G.farY, dx: R(0.18, 0.3) * W * (rnd() < 0.5 ? -1 : 1), dy: R(0.08, 0.16) * G.farY };
          fx.nextShoot = t + R(18, 36);
        }
      }
      if (fx.shoot) {
        const k = (t - fx.shoot.t0) / 0.95;
        if (k >= 1) fx.shoot = null;
        else {
          const e = ease.outQuad(k);
          const x = fx.shoot.x0 + fx.shoot.dx * e;
          const y = fx.shoot.y0 + fx.shoot.dy * e;
          const tail = 0.22;
          const tx = fx.shoot.x0 + fx.shoot.dx * Math.max(0, e - tail);
          const ty = fx.shoot.y0 + fx.shoot.dy * Math.max(0, e - tail);
          const a = Math.sin(Math.PI * k) * c.stars;
          const g = ctx.createLinearGradient(x, y, tx, ty);
          g.addColorStop(0, 'rgba(255,255,255,' + a.toFixed(3) + ')');
          g.addColorStop(1, 'rgba(180,200,255,0)');
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }
      }
    }

    function drawSun(c, p, t) {
      const s = sunPos(p);
      const Rs = G.sunR;
      if (s.y - Rs * 3 > G.groundY) return s;
      // A wide, soft glow that warms with the hour
      const glowR = Rs * (3.2 + c.warmth * 2.4);
      const g = ctx.createRadialGradient(s.x, s.y, Rs * 0.4, s.x, s.y, glowR);
      g.addColorStop(0, css(c.sunGlow, 0.75));
      g.addColorStop(0.35, css(c.sunGlow, 0.22 + c.warmth * 0.12));
      g.addColorStop(1, css(c.sunGlow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(s.x - glowR, s.y - glowR, glowR * 2, glowR * 2);

      // Golden-hour rays, slowly turning
      if (c.warmth > 0.3 && !reduce) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const rays = 9;
        for (let i = 0; i < rays; i++) {
          const a = (i / rays) * TAU + t * 0.03;
          const len = Rs * (5 + 2.5 * Math.sin(i * 1.7 + t * 0.4));
          const wdt = 0.07;
          const grd = ctx.createRadialGradient(s.x, s.y, Rs, s.x, s.y, len);
          grd.addColorStop(0, css(c.sunGlow, 0.1 * c.warmth));
          grd.addColorStop(1, css(c.sunGlow, 0));
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.arc(s.x, s.y, len, a - wdt, a + wdt);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // The disc
      const d = ctx.createRadialGradient(s.x - Rs * 0.3, s.y - Rs * 0.35, Rs * 0.1, s.x, s.y, Rs);
      d.addColorStop(0, css(U.mix(c.sun, [255, 255, 255], 0.55)));
      d.addColorStop(1, css(c.sun));
      ctx.fillStyle = d;
      ctx.beginPath();
      ctx.arc(s.x, s.y, Rs, 0, TAU);
      ctx.fill();

      drawSunFace(s, Rs, p, t);
      return s;
    }

    /* The sun's face: a peek at the tree every so often, and a yawn at golden hour. */
    function drawSunFace(s, Rs, p, t) {
      if (reduce) return;
      if (!face.next) face.next = t + R(7, 11);
      const golden = p > 0.76 && p < 0.9;
      if (!face.anim && t >= face.next && s.y < G.farY - Rs * 0.4) {
        const kind = golden && !face.yawned ? 'yawn' : 'peek';
        if (kind === 'yawn') face.yawned = true;
        face.anim = { kind, t0: t, dur: kind === 'yawn' ? 5.2 : 5.6 };
      }
      if (!face.anim) return;
      const k = t - face.anim.t0;
      if (k > face.anim.dur) {
        face.anim = null;
        face.next = t + R(38, 70);
        return;
      }
      const yawn = face.anim.kind === 'yawn';
      const alpha = span(k, 0, 0.6) * (1 - span(k, face.anim.dur - 0.9, face.anim.dur));
      // Eyes: 0 closed … 1 open; blinks are quick dips
      let open;
      let happy = false;
      let lookX = 0;
      let lookY = 0;
      let mouth = 0; // 0 smile … 1 wide yawn
      if (!yawn) {
        open = span(k, 0.55, 0.85) * (1 - span(k, 3.9, 4.15));
        happy = k < 0.55 || k > 4.1;
        const blink = (at) => 1 - Math.max(0, 1 - Math.abs(k - at) / 0.09);
        open *= blink(1.85) * blink(3.25);
        // Look toward the tree first, then at you
        const tx = G.cx - s.x;
        const ty = G.soilY - G.scale * 0.5 - s.y;
        const m = Math.hypot(tx, ty) || 1;
        const toward = span(k, 0.9, 1.3) * (1 - span(k, 2.6, 3.0));
        lookX = (tx / m) * toward;
        lookY = (ty / m) * toward;
      } else {
        open = 0.45 * (1 - span(k, 0.8, 1.2)) + 0.3 * span(k, 2.5, 3.0) * (1 - span(k, 3.4, 3.8));
        mouth = span(k, 0.9, 1.6, ease.outCubic) * (1 - span(k, 2.3, 2.8, ease.inOutSine));
        happy = k > 3.8;
      }

      ctx.save();
      ctx.globalAlpha = alpha * 0.92;
      ctx.translate(s.x, s.y);
      if (yawn) ctx.rotate(-0.08 * mouth);
      // Rosy cheeks
      ctx.fillStyle = 'rgba(255,128,118,0.34)';
      ctx.beginPath(); ctx.ellipse(-Rs * 0.5, Rs * 0.2, Rs * 0.17, Rs * 0.12, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(Rs * 0.5, Rs * 0.2, Rs * 0.17, Rs * 0.12, 0, 0, TAU); ctx.fill();
      // Eyes
      const ex = Rs * 0.3;
      const ey = -Rs * 0.1;
      ctx.fillStyle = '#3B2A1E';
      ctx.strokeStyle = '#3B2A1E';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.4, Rs * 0.065);
      [-1, 1].forEach(sd => {
        const x = sd * ex + lookX * Rs * 0.07;
        const y = ey + lookY * Rs * 0.05;
        if (open > 0.18) {
          ctx.beginPath();
          ctx.ellipse(x, y, Rs * 0.075, Rs * 0.11 * open, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.beginPath();
          ctx.arc(x + Rs * 0.025, y - Rs * 0.04 * open, Rs * 0.025, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#3B2A1E';
        } else if (happy) {
          ctx.beginPath();
          ctx.arc(sd * ex, ey + Rs * 0.05, Rs * 0.08, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(sd * ex - Rs * 0.08, ey + Rs * 0.02);
          ctx.quadraticCurveTo(sd * ex, ey + Rs * 0.07, sd * ex + Rs * 0.08, ey + Rs * 0.02);
          ctx.stroke();
        }
      });
      // Mouth
      if (mouth > 0.05) {
        ctx.fillStyle = '#5A2A22';
        ctx.beginPath();
        ctx.ellipse(0, Rs * 0.3, Rs * (0.09 + 0.06 * mouth), Rs * (0.05 + 0.15 * mouth), 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,140,130,0.8)';
        ctx.beginPath();
        ctx.ellipse(0, Rs * (0.3 + 0.1 * mouth), Rs * 0.07 * mouth, Rs * 0.04 * mouth, 0, 0, TAU);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, Rs * 0.12, Rs * 0.2, Math.PI * 0.18, Math.PI * 0.82);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawMoon(c, p, t) {
      const m = moonPos(p);
      if (m.a <= 0.01) return;
      const Rm = G.sunR * 0.8;
      const g = ctx.createRadialGradient(m.x, m.y, Rm * 0.6, m.x, m.y, Rm * 4.2);
      g.addColorStop(0, 'rgba(190,205,255,' + (0.28 * m.a).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(190,205,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(m.x - Rm * 4.2, m.y - Rm * 4.2, Rm * 8.4, Rm * 8.4);

      ctx.save();
      ctx.globalAlpha = m.a;
      const d = ctx.createRadialGradient(m.x - Rm * 0.35, m.y - Rm * 0.35, Rm * 0.1, m.x, m.y, Rm);
      d.addColorStop(0, '#FFFBEA');
      d.addColorStop(1, '#F1E6C4');
      ctx.fillStyle = d;
      ctx.beginPath();
      ctx.arc(m.x, m.y, Rm, 0, TAU);
      ctx.fill();
      // Soft craters
      ctx.fillStyle = 'rgba(214,200,160,0.35)';
      [[0.32, -0.3, 0.16], [-0.38, 0.32, 0.12], [0.42, 0.4, 0.08]].forEach(q => {
        ctx.beginPath();
        ctx.arc(m.x + q[0] * Rm, m.y + q[1] * Rm, q[2] * Rm, 0, TAU);
        ctx.fill();
      });
      // Fast asleep: closed eyes, a small smile, a blush
      ctx.strokeStyle = '#6A5A48';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.2, Rm * 0.06);
      [-1, 1].forEach(sd => {
        ctx.beginPath();
        ctx.arc(m.x + sd * Rm * 0.3 - Rm * 0.05, m.y - Rm * 0.06, Rm * 0.11, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      });
      ctx.beginPath();
      ctx.arc(m.x - Rm * 0.05, m.y + Rm * 0.2, Rm * 0.12, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,150,150,0.28)';
      ctx.beginPath();
      ctx.ellipse(m.x - Rm * 0.48, m.y + Rm * 0.12, Rm * 0.13, Rm * 0.09, 0, 0, TAU);
      ctx.fill();
      ctx.restore();

      // Z, z, z…
      if (!reduce && m.a > 0.6) {
        if (!fx.nextZ) fx.nextZ = t + 1;
        if (t > fx.nextZ) {
          for (let i = 0; i < 3; i++) fx.zs.push({ t0: t + i * 0.85, x: m.x + Rm * 0.75, y: m.y - Rm * 0.7, size: Rm * (0.32 + i * 0.1) });
          fx.nextZ = t + R(7, 10);
        }
      }
      for (let i = fx.zs.length - 1; i >= 0; i--) {
        const z = fx.zs[i];
        const k = (t - z.t0) / 3.2;
        if (k < 0) continue;
        if (k > 1) { fx.zs.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = Math.sin(Math.PI * k) * 0.85 * m.a;
        ctx.fillStyle = '#E9E4FF';
        ctx.font = 'italic 600 ' + (z.size * (0.7 + k * 0.6)).toFixed(1) + 'px Fraunces, Georgia, serif';
        ctx.fillText('z', z.x + k * Rm * 0.9 + Math.sin(k * 6) * Rm * 0.08, z.y - k * Rm * 1.6);
        ctx.restore();
      }
    }

    /* Clouds: shade, body, then a sunlit cap. */
    function drawClouds(c, dt, layerNear) {
      const light = sunPos(lastP < 0 ? 0 : lastP);
      for (const cl of G.clouds) {
        if (cl.near !== layerNear) continue;
        if (!reduce) cl.x += cl.speed * dt;
        const half = cl.size * 0.75;
        if (cl.x - half > W + 30) cl.x = -half - 30;
        const a = cl.alpha * (1 - 0.45 * c.night);
        const lx = clamp((light.x - cl.x) / W, -1, 1);
        const b = cl.base;
        const shapes = dy => {
          // one path for the whole cloud, so overlaps don't double up the alpha
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(cl.x - b.w / 2, cl.y - b.h + dy, b.w, b.h, b.h / 2);
          else ctx.rect(cl.x - b.w / 2, cl.y - b.h + dy, b.w, b.h);
          for (const q of cl.puffs) {
            ctx.moveTo(cl.x + q.x + q.r, cl.y + q.y + dy);
            ctx.arc(cl.x + q.x, cl.y + q.y + dy, q.r, 0, TAU);
          }
          ctx.fill('nonzero');
        };
        ctx.fillStyle = css(c.cloudShade, a);
        shapes(cl.size * 0.035);
        ctx.fillStyle = css(c.cloudLit, a);
        ctx.save();
        ctx.translate(lx * cl.size * 0.012, -cl.size * 0.012);
        shapes(-cl.size * 0.01);
        ctx.restore();
        ctx.fillStyle = css(U.mix(c.cloudLit, [255, 255, 255], 0.6), a * 0.55 * (1 - c.night));
        for (const q of cl.puffs) {
          if (!q.top) continue;
          ctx.beginPath();
          ctx.arc(cl.x + q.x + lx * q.r * 0.25, cl.y + q.y - q.r * 0.28, q.r * 0.5, 0, TAU);
          ctx.fill();
        }
      }
    }

    /* Hills, the far trees, the cottage and its chimney smoke. */
    function drawLand(c, t, dt) {
      // Haze along the horizon
      const hz = ctx.createLinearGradient(0, G.farY - H * 0.12, 0, G.farY + 10);
      hz.addColorStop(0, css(c.haze, 0));
      hz.addColorStop(1, css(c.haze, 0.55));
      ctx.fillStyle = hz;
      ctx.fillRect(0, G.farY - H * 0.12, W, H * 0.12 + 10);

      ctx.fillStyle = css(c.far);
      ctx.fill(G.farPath);
      const treeCol = css(U.mix(c.far, c.nearDeep, 0.35));
      ctx.fillStyle = treeCol;
      ctx.strokeStyle = treeCol;
      for (const ft of G.farTrees) {
        const y = G.far.at(ft.x);
        ctx.lineWidth = Math.max(1, ft.r * 0.3);
        ctx.beginPath();
        ctx.moveTo(ft.x, y + 2);
        ctx.lineTo(ft.x + ft.lean * ft.r, y - ft.r * 1.1);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ft.x + ft.lean * ft.r, y - ft.r * 1.6, ft.r, 0, TAU);
        ctx.fill();
      }

      ctx.fillStyle = css(c.mid);
      ctx.fill(G.midPath);
      if (G.cottage) drawCottage(c, t, dt);

      const ng = ctx.createLinearGradient(0, G.groundY - 20, 0, H);
      ng.addColorStop(0, css(c.near));
      ng.addColorStop(1, css(c.nearDeep));
      ctx.fillStyle = ng;
      ctx.fill(G.nearPath);
    }

    function drawCottage(c, t, dt) {
      const k = G.cottage;
      const w = k.w;
      const x = k.x;
      const y = k.y;
      const night = c.night;
      const wall = U.mix([246, 234, 216], [58, 54, 82], night);
      const wallShade = U.mix([222, 204, 182], [44, 40, 64], night);
      const roof = U.mix([200, 102, 74], [74, 47, 58], night);
      const bodyH = w * 0.62;
      // Chimney and smoke
      const chX = x + w * 0.22;
      const chTop = y - bodyH - w * 0.52;
      ctx.fillStyle = css(roof);
      ctx.fillRect(chX - w * 0.07, chTop, w * 0.14, w * 0.3);
      if (!reduce) {
        if (t > fx.nextSmoke) {
          fx.smoke.push({ x: chX, y: chTop, t0: t, drift: R(-0.4, 0.4) });
          fx.nextSmoke = t + R(0.7, 1.2);
        }
        for (let i = fx.smoke.length - 1; i >= 0; i--) {
          const s = fx.smoke[i];
          const age = (t - s.t0) / 6;
          if (age > 1) { fx.smoke.splice(i, 1); continue; }
          const px = s.x + (windNow * 0.8 + 0.6 + s.drift) * age * w * 1.6;
          const py = s.y - age * w * 2.4;
          const rr = w * (0.08 + age * 0.22);
          ctx.fillStyle = css(U.mix([236, 236, 240], [96, 104, 140], night), 0.38 * (1 - age));
          ctx.beginPath();
          ctx.arc(px, py, rr, 0, TAU);
          ctx.fill();
        }
      }
      // Walls, the shaded side, the roof
      ctx.fillStyle = css(wall);
      ctx.fillRect(x - w * 0.5, y - bodyH, w, bodyH);
      ctx.fillStyle = css(wallShade);
      ctx.fillRect(x + w * 0.18, y - bodyH, w * 0.32, bodyH);
      ctx.fillStyle = css(roof);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.62, y - bodyH + 1);
      ctx.lineTo(x, y - bodyH - w * 0.5);
      ctx.lineTo(x + w * 0.62, y - bodyH + 1);
      ctx.closePath();
      ctx.fill();
      // Door and window; the window lights up as evening comes on
      ctx.fillStyle = css(U.mix([122, 90, 68], [40, 30, 34], night));
      ctx.fillRect(x - w * 0.32, y - bodyH * 0.62, w * 0.2, bodyH * 0.62);
      const lit = span(night, 0.25, 0.6);
      const win = U.mix([160, 200, 232], [255, 214, 122], lit);
      if (lit > 0.05) {
        const gl = ctx.createRadialGradient(x + w * 0.05, y - bodyH * 0.55, 0, x + w * 0.05, y - bodyH * 0.55, w * 1.2);
        gl.addColorStop(0, 'rgba(255,210,122,' + (0.45 * lit).toFixed(3) + ')');
        gl.addColorStop(1, 'rgba(255,210,122,0)');
        ctx.fillStyle = gl;
        ctx.fillRect(x - w * 1.2, y - bodyH * 0.55 - w * 1.2, w * 2.4, w * 2.4);
      }
      ctx.fillStyle = css(win);
      ctx.fillRect(x - w * 0.04, y - bodyH * 0.72, w * 0.2, w * 0.18);
    }

    /* ═══ 6. The bonsai: drawing it ═══════════════════════════ */
    function lightDir(p) {
      const src = p > 0.9 ? (() => { const m = moonPos(p); return { x: m.x, y: m.y }; })() : sunPos(p);
      const tx = G.cx;
      const ty = G.soilY - G.scale * 0.6;
      const dx = src.x - tx;
      const dy = src.y - ty;
      const m = Math.hypot(dx, dy) || 1;
      return { x: dx / m, y: dy / m };
    }

    /** A tapered limb along `curve`, grown to `reveal` (0..1), lit from `L`.
        With `foot` (a length), the base stands level and turns to follow the curve over that length. */
    function drawLimb(curve, reveal, halfFn, widthScale, c, L, grain, foot) {
      if (reveal <= 0.002) return;
      const lr = curve.len * reveal;
      const taper = Math.min(curve.len * 0.14, lr);
      const pts = curve.pts;
      const mids = [];
      for (let i = 0; i < pts.length; i++) {
        let q = pts[i];
        let last = false;
        if (q.l >= lr) { q = pointAt(curve, lr); last = true; }
        let hw = halfFn(q.l / curve.len) * widthScale;
        const remain = lr - q.l;
        if (remain < taper) hw *= lerp(0.45, 1, remain / (taper || 1));
        let nx = q.nx;
        let ny = q.ny;
        if (foot && q.l < foot) {
          // Level at the soil, so a leaning trunk neither digs in on one side nor lifts on the other
          const k = ease.inOutSine(q.l / foot);
          nx = lerp(Math.sign(q.nx) || 1, q.nx, k);
          ny = lerp(0, q.ny, k);
          const m = Math.hypot(nx, ny) || 1;
          nx /= m;
          ny /= m;
        }
        mids.push({ x: q.x, y: q.y, nx, ny, hw });
        if (last) break;
      }
      if (mids.length < 2) return;
      const shape = (a, b) => {
        // the polygon between offsets a and b (fractions of the half-width), in screen space
        ctx.beginPath();
        mids.forEach((m, i) => {
          const x = sx(m.x + m.nx * m.hw * a, m.y + m.ny * m.hw * a);
          const y = sy(m.y + m.ny * m.hw * a);
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        });
        for (let i = mids.length - 1; i >= 0; i--) {
          const m = mids[i];
          ctx.lineTo(sx(m.x + m.nx * m.hw * b, m.y + m.ny * m.hw * b), sy(m.y + m.ny * m.hw * b));
        }
        ctx.closePath();
        ctx.fill();
      };
      // Shadowed body
      ctx.fillStyle = css(c.barkShade);
      shape(1, -1);
      const tip = mids[mids.length - 1];
      ctx.beginPath();
      ctx.arc(sx(tip.x, tip.y), sy(tip.y), tip.hw * G.scale, 0, TAU);
      ctx.fill();
      // The lit side, toward the light
      const facing = m => clamp((m.nx * L.x + m.ny * L.y) * 3, -1, 1);
      ctx.fillStyle = css(c.bark);
      ctx.beginPath();
      mids.forEach((m, i) => {
        const f = facing(m);
        const o = 0.4 * f;
        const a = o + 0.55;
        const x = sx(m.x + m.nx * m.hw * a, m.y + m.ny * m.hw * a);
        const y = sy(m.y + m.ny * m.hw * a);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      for (let i = mids.length - 1; i >= 0; i--) {
        const m = mids[i];
        const b = 0.4 * facing(m) - 0.55;
        ctx.lineTo(sx(m.x + m.nx * m.hw * b, m.y + m.ny * m.hw * b), sy(m.y + m.ny * m.hw * b));
      }
      ctx.closePath();
      ctx.fill();
      // A thread of rim light
      ctx.strokeStyle = css(c.rim, 0.38 * c.light);
      ctx.lineWidth = Math.max(0.8, tip.hw * G.scale * 0.35);
      ctx.lineCap = 'round';
      ctx.beginPath();
      mids.forEach((m, i) => {
        const o = 0.78 * facing(m);
        const x = sx(m.x + m.nx * m.hw * o, m.y + m.ny * m.hw * o);
        const y = sy(m.y + m.ny * m.hw * o);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.stroke();
      // Bark grain on the trunk
      if (grain && mids.length > 6) {
        ctx.strokeStyle = css(c.barkShade, 0.45);
        ctx.lineWidth = Math.max(0.6, G.scale * 0.004);
        [-0.42, 0.1, 0.55].forEach((o, j) => {
          ctx.beginPath();
          const end = Math.floor(mids.length * (0.55 + j * 0.1));
          for (let i = 1; i < end; i++) {
            const m = mids[i];
            const w = o + Math.sin(i * 0.9 + j) * 0.08;
            const x = sx(m.x + m.nx * m.hw * w, m.y + m.ny * m.hw * w);
            const y = sy(m.y + m.ny * m.hw * w);
            if (i > 1) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.stroke();
        });
      }
    }

    function drawPot(c, p, t) {
      const s = G.scale;
      const X = x => G.cx + x * s;
      const Y = y => G.soilY + y * s;
      // Shadow on the grass
      ctx.fillStyle = 'rgba(10,20,10,' + (0.22 - 0.1 * c.night).toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(X(0), Y(0.17), s * 0.42, s * 0.035, 0, 0, TAU);
      ctx.fill();
      // Feet
      ctx.fillStyle = css(c.potShade);
      [-1, 1].forEach(sd => {
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(X(sd * 0.21 - 0.035), Y(0.13), s * 0.07, s * 0.04, s * 0.01) : ctx.rect(X(sd * 0.21 - 0.035), Y(0.13), s * 0.07, s * 0.04);
        ctx.fill();
      });
      // Body: a glazed, slightly tapered tray
      const body = new Path2D();
      body.moveTo(X(-0.315), Y(0.02));
      body.lineTo(X(0.315), Y(0.02));
      body.quadraticCurveTo(X(0.3), Y(0.12), X(0.255), Y(0.143));
      body.lineTo(X(-0.255), Y(0.143));
      body.quadraticCurveTo(X(-0.3), Y(0.12), X(-0.315), Y(0.02));
      body.closePath();
      const bg = ctx.createLinearGradient(0, Y(0.02), 0, Y(0.143));
      bg.addColorStop(0, css(c.potBody));
      bg.addColorStop(1, css(c.potShade));
      ctx.fillStyle = bg;
      ctx.fill(body);
      // A painted band in the JoyPro spectrum
      ctx.save();
      ctx.clip(body);
      const band = ctx.createLinearGradient(X(-0.32), 0, X(0.32), 0);
      U.SPECTRUM.forEach((h, i) => band.addColorStop(i / (U.SPECTRUM.length - 1), h));
      ctx.globalAlpha = 0.85 * (0.45 + 0.55 * (1 - c.night));
      ctx.fillStyle = band;
      ctx.fillRect(X(-0.33), Y(0.066), s * 0.66, s * 0.016);
      ctx.globalAlpha = 1;
      // Glaze highlight on the side facing the light
      const L = lightDir(p);
      const hx = X(L.x > 0 ? 0.17 : -0.24);
      const hl = ctx.createLinearGradient(hx, 0, hx + s * 0.07, 0);
      hl.addColorStop(0, 'rgba(255,255,255,0)');
      hl.addColorStop(0.5, 'rgba(255,255,255,' + (0.22 * c.light).toFixed(3) + ')');
      hl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hl;
      ctx.fillRect(hx, Y(0.02), s * 0.07, s * 0.13);
      ctx.restore();
      // Rim
      ctx.fillStyle = css(c.potRim);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(X(-0.335), Y(-0.012), s * 0.67, s * 0.036, s * 0.012);
      else ctx.rect(X(-0.335), Y(-0.012), s * 0.67, s * 0.036);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,' + (0.18 * c.light).toFixed(3) + ')';
      ctx.fillRect(X(-0.32), Y(-0.01), s * 0.64, Math.max(1, s * 0.006));
      // Soil
      ctx.fillStyle = css(c.soil);
      ctx.beginPath();
      ctx.ellipse(X(0), Y(SOIL.y), s * SOIL.rx, s * SOIL.ry, 0, Math.PI, TAU);
      ctx.fill();
    }

    /** Moss on the soil, drawn after the trunk so it tucks in around the foot. */
    function drawMoss(c) {
      const s = G.scale;
      for (const m of tree.moss) {
        ctx.fillStyle = css(U.mix(c.moss, c.leafLight, m.shade * 0.4));
        ctx.beginPath();
        ctx.arc(G.cx + m.x * s, G.soilY + SOIL.y * s, m.r * s, Math.PI, TAU);
        ctx.fill();
      }
    }

    function drawSprout(c, p, t) {
      const show = (0.55 + 0.45 * span(p, 0, 0.03)) * (1 - span(p, 0.08, 0.16));
      if (show <= 0.01) return;
      const s = G.scale;
      const wob = reduce ? 0 : Math.sin(t * 1.6) * 0.06;
      const h = 0.07 * show;
      ctx.save();
      ctx.translate(G.cx, G.soilY + (soilTop(0) + 0.006) * s); // just under the soil, which hides its foot
      ctx.rotate(tree.sproutLean * 0.3 + wob);
      ctx.strokeStyle = css(U.mix(c.leafMid, c.leafLight, 0.3));
      ctx.lineWidth = Math.max(1.4, s * 0.012);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * 0.012, -s * h * 0.5, 0, -s * h);
      ctx.stroke();
      ctx.fillStyle = css(c.leafLight);
      [-1, 1].forEach(sd => {
        ctx.save();
        ctx.translate(0, -s * h);
        ctx.rotate(sd * 0.85 + wob * 0.5);
        ctx.beginPath();
        ctx.ellipse(sd * s * 0.026 * show, 0, s * 0.03 * show, s * 0.014 * show, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      });
      ctx.restore();
    }

    function drawMushroom(c, p, t, instant) {
      const m = tree.mushroom;
      const k = pop(m, p, t, instant, 0.9);
      if (k <= 0) return;
      const s = G.scale * 0.032 * m.size * k;
      const x = G.cx + m.x * G.scale;
      const y = G.soilY + (soilTop(m.x) + 0.003) * G.scale; // standing in the soil, not on its face
      if (c.night > 0.4) {
        const gl = ctx.createRadialGradient(x, y - s, 0, x, y - s, s * 4);
        gl.addColorStop(0, 'rgba(140,255,210,' + (0.35 * span(c.night, 0.4, 0.9)).toFixed(3) + ')');
        gl.addColorStop(1, 'rgba(140,255,210,0)');
        ctx.fillStyle = gl;
        ctx.fillRect(x - s * 4, y - s * 5, s * 8, s * 8);
      }
      ctx.fillStyle = css(U.mix([246, 236, 218], [120, 150, 150], c.night));
      ctx.fillRect(x - s * 0.28, y - s * 1.0, s * 0.56, s * 1.0);
      ctx.fillStyle = css(U.mix([217, 72, 59], [90, 60, 90], c.night * 0.8));
      ctx.beginPath();
      ctx.ellipse(x, y - s * 1.0, s * 0.95, s * 0.75, 0, Math.PI, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      [[-0.45, -1.4, 0.16], [0.2, -1.55, 0.13], [0.55, -1.2, 0.11]].forEach(d => {
        ctx.beginPath();
        ctx.arc(x + d[0] * s, y + d[1] * s, d[2] * s, 0, TAU);
        ctx.fill();
      });
    }

    function drawPad(pad, c, p, t, L, instant) {
      const s = G.scale;
      const fill = 1 + 0.1 * span(p, pad.birth + 0.12, 0.88, ease.outQuad);
      const bob = reduce ? 0 : Math.sin(t * 1.1 + pad.phase) * 0.004;
      const cx = pad.cx;
      const cy = pad.cy + bob;
      const live = [];
      for (const q of pad.puffs) {
        const k = pop(q, p, t, instant, 0.8);
        if (k <= 0) continue;
        live.push({ q, k, x: sx(cx + q.x * fill, cy + q.y * fill), y: sy(cy + q.y * fill), r: q.r * fill * k * s });
      }
      if (!live.length) return;
      const lx = L.x;
      ctx.fillStyle = css(c.leafDark);
      for (const o of live) {
        ctx.beginPath();
        ctx.arc(o.x - lx * o.r * 0.16, o.y + o.r * 0.22, o.r, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = css(c.leafMid);
      for (const o of live) {
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r * 0.9, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = css(c.leafLight);
      for (const o of live) {
        if (o.q.y > pad.h * 0.22) continue;
        ctx.beginPath();
        ctx.arc(o.x + lx * o.r * 0.26, o.y - o.r * 0.3, o.r * 0.58, 0, TAU);
        ctx.fill();
      }
      // Leaf flecks and a sliver of rim light on the crown
      ctx.fillStyle = css(U.mix(c.leafLight, c.rim, 0.35), 0.75);
      for (const o of live) {
        if (o.q.y > 0) continue;
        const a = o.q.leaf;
        ctx.beginPath();
        ctx.ellipse(o.x + Math.cos(a) * o.r * 0.42 + lx * o.r * 0.2, o.y - o.r * 0.42, o.r * 0.13, o.r * 0.06, a, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = css(c.rim, 0.45 * c.light);
      for (const o of live) {
        if (o.q.y > -pad.h * 0.25) continue;
        ctx.beginPath();
        ctx.arc(o.x + lx * o.r * 0.5, o.y - o.r * 0.5, o.r * 0.2, 0, TAU);
        ctx.fill();
      }
    }

    function drawBlossoms(c, p, t, instant) {
      const s = G.scale;
      const glow = span(c.night, 0.5, 1);
      for (const b of tree.blossoms) {
        const k = pop(b, p, t, instant, 0.7);
        if (k <= 0) continue;
        const pad = b.pad;
        const fill = 1 + 0.1 * span(p, pad.birth + 0.12, 0.88, ease.outQuad);
        const bob = reduce ? 0 : Math.sin(t * 1.1 + pad.phase) * 0.004;
        const x = sx(pad.cx + b.x * fill, pad.cy + bob + b.y * fill);
        const y = sy(pad.cy + bob + b.y * fill);
        const r = b.size * s * k;
        const petal = U.hex(b.alt ? tree.bloom.petal2 : tree.bloom.petal);
        const tint = U.mix(petal, c.leafDark, c.night * 0.45);
        if (glow > 0) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
          g.addColorStop(0, css(petal, 0.28 * glow));
          g.addColorStop(1, css(petal, 0));
          ctx.fillStyle = g;
          ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
        }
        ctx.fillStyle = css(tint);
        for (let i = 0; i < 5; i++) {
          const a = b.rot + (i / 5) * TAU;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.52, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = css(U.mix(U.hex(tree.bloom.heart), c.leafDark, c.night * 0.3));
        ctx.beginPath();
        ctx.arc(x, y, r * 0.3, 0, TAU);
        ctx.fill();
      }
    }

    /* Young limbs carry a few leaves at their growing tips until their foliage pad arrives. */
    function drawTipLeaves(curve, reveal, size, fade, c, t, phase) {
      if (reveal <= 0.01 || fade <= 0.01) return;
      const lr = curve.len * reveal;
      const tip = pointAt(curve, lr);
      const back = pointAt(curve, Math.max(0, lr - 0.02));
      const ang = Math.atan2(tip.y - back.y, tip.x - back.x);
      const x = sx(tip.x, tip.y);
      const y = sy(tip.y);
      const s = G.scale * size;
      const wob = reduce ? 0 : Math.sin(t * 1.7 + phase) * 0.12;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(x, y);
      ctx.rotate(ang + Math.PI / 2 + wob);
      [[-0.95, c.leafMid], [0.95, c.leafMid], [0, c.leafLight]].forEach(([a, col]) => {
        ctx.save();
        ctx.rotate(a);
        ctx.fillStyle = css(col);
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.55, s * 0.24, s * 0.55, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      });
      ctx.restore();
    }

    /** Surface roots: humps on the soil that come out from under the foot and dive back in. */
    function drawRoots(c, p, maturity, widthScale) {
      const grow = span(p, 0.02, 0.5, ease.outCubic);
      if (grow <= 0) return;
      const footL = Math.min(0.04, tree.trunk.len * trunkReveal(p));
      const foot = pointAt(tree.trunk, footL);
      const footHalf = tree.trunkHalf(footL / tree.trunk.len, maturity) * widthScale;
      const N = 16;
      for (const rt of tree.roots) {
        const sd = rt.side;
        const xIn = foot.x + sd * footHalf * 0.3;
        const xOut = foot.x + sd * (footHalf * 0.9 + rt.at * widthScale);
        const reach = rt.reach * grow * (0.4 + 0.6 * widthScale);
        const H = rt.thick * widthScale * grow;
        const top = [[xIn, soilTop(xIn) - H]];
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          const x = xOut + sd * reach * u;
          top.push([x, soilTop(x) - H * Math.pow(1 - u, 1.5) * (1 + rt.hump * Math.sin(Math.PI * u))]);
        }
        const tip = top[top.length - 1];
        // The body, closed under the soil (the clip hides that part)
        ctx.fillStyle = css(c.barkShade);
        ctx.beginPath();
        top.forEach(([x, y], i) => { if (i) ctx.lineTo(sx(x, y), sy(y)); else ctx.moveTo(sx(x, y), sy(y)); });
        ctx.lineTo(sx(tip[0], 0.03), sy(0.03));
        ctx.lineTo(sx(xIn, 0.03), sy(0.03));
        ctx.closePath();
        ctx.fill();
        // Its lit back, a band just under the top edge
        ctx.fillStyle = css(c.bark);
        ctx.beginPath();
        top.forEach(([x, y], i) => {
          const h = soilTop(x) - y;
          const yy = y + h * 0.12;
          if (i) ctx.lineTo(sx(x, yy), sy(yy)); else ctx.moveTo(sx(x, yy), sy(yy));
        });
        for (let i = top.length - 1; i >= 0; i--) {
          const [x, y] = top[i];
          const yy = y + (soilTop(x) - y) * 0.55;
          ctx.lineTo(sx(x, yy), sy(yy));
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    function drawTree(c, p, t, instant) {
      const L = lightDir(p);
      // Slender as a sapling, thickening all segment long
      const maturity = Math.pow(span(p, 0.03, 0.95), 1.25);
      const widthScale = 0.1 + 0.9 * maturity;
      const trunkHalf = s => tree.trunkHalf(s, maturity);
      const reveal = trunkReveal(p);
      // Planted: the sprout, the roots and the trunk's foot all stop at the soil
      ctx.save();
      ctx.clip(G.aboveSoil);
      drawSprout(c, p, t);
      drawRoots(c, p, maturity, widthScale);
      drawLimb(tree.trunk, reveal, trunkHalf, widthScale, c, L, true, FOOT);
      ctx.restore();
      drawMoss(c);
      drawMushroom(c, p, t, instant);
      const limbScale = 0.35 + 0.65 * widthScale;
      const apex = tree.pads.find(pd => pd.apex);
      for (const br of tree.branches) {
        const g = span(p, br.birth, br.birth + br.grow, ease.outCubic);
        drawLimb(br.curve, g, br.half, limbScale, c, L, false);
        for (const sub of br.subs) {
          drawLimb(sub.curve, span(p, sub.birth, sub.birth + sub.grow, ease.outCubic), sub.half, limbScale, c, L, false);
        }
      }
      // The sapling's leafy tip, until the crown takes over
      const crownIn = apex ? span(p, apex.birth - 0.02, apex.birth + 0.06) : 1;
      drawTipLeaves(tree.trunk, reveal, 0.05 + 0.02 * maturity, span(p, 0.035, 0.07) * (1 - crownIn), c, t, 0);
      for (const br of tree.branches) {
        const g = span(p, br.birth, br.birth + br.grow, ease.outCubic);
        const padIn = span(p, br.birth + 0.07, br.birth + 0.1);
        drawTipLeaves(br.curve, g, 0.04, span(g, 0.15, 0.35) * (1 - padIn), c, t, br.f * 10);
      }
      for (const pad of tree.pads) drawPad(pad, c, p, t, L, instant);
      drawBlossoms(c, p, t, instant);
    }

    /* ═══ 7. Visitors and effects ═════════════════════════════ */
    function drawGrass(c, t) {
      const sway = windNow;
      ctx.lineCap = 'round';
      ctx.strokeStyle = css(c.grass);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (const tf of G.tufts) {
        const y = G.near.at(tf.x) + 2;
        for (let i = 0; i < tf.n; i++) {
          const bx = tf.x + (i - tf.n / 2) * 2.2;
          const len = tf.len * (0.75 + 0.25 * Math.sin(i * 2.3 + tf.x));
          const bend = (tf.lean + (i - tf.n / 2) * 0.22 + sway * 0.35) * len;
          ctx.moveTo(bx, y);
          ctx.quadraticCurveTo(bx + bend * 0.25, y - len * 0.6, bx + bend, y - len);
        }
      }
      ctx.stroke();
      // Wildflowers in the JoyPro colors; they fold up at night
      const open = 1 - 0.55 * c.night;
      for (const f of G.flowers) {
        const y = G.near.at(f.x) + 2;
        const lean = (Math.sin(t * 0.9 + f.ph) * 0.12 + sway * 0.3) * f.h;
        const hx = f.x + lean;
        const hy = y - f.h;
        ctx.strokeStyle = css(c.grass);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(f.x, y);
        ctx.quadraticCurveTo(f.x + lean * 0.3, y - f.h * 0.6, hx, hy);
        ctx.stroke();
        const col = U.mix(f.c, c.nearDeep, c.night * 0.6);
        ctx.fillStyle = css(col);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + f.ph;
          ctx.beginPath();
          ctx.arc(hx + Math.cos(a) * f.r * open, hy + Math.sin(a) * f.r * open, f.r * 0.62 * open + 0.4, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = css(U.mix([255, 228, 140], c.nearDeep, c.night * 0.5));
        ctx.beginPath();
        ctx.arc(hx, hy, f.r * 0.45, 0, TAU);
        ctx.fill();
      }
    }

    function drawButterflies(c, p, t) {
      const vis = span(p, 0.03, 0.09) * (1 - span(p, 0.72, 0.8));
      if (vis <= 0.01 || reduce) return;
      for (const b of butterflies) {
        const x = G.cx + Math.sin(t * b.f[0] + b.ph[0]) * b.rx + Math.sin(t * b.f[1] + b.ph[1]) * b.rx * 0.3;
        const y = G.soilY - G.scale * 0.55 + Math.sin(t * b.f[2] + b.ph[2]) * b.ry + Math.sin(t * b.f[3] + b.ph[3]) * b.ry * 0.35;
        const dir = x >= b.prevX ? 1 : -1;
        b.prevX = x;
        const flap = 0.25 + 0.75 * Math.abs(Math.sin(t * 15 + b.ph[0]));
        const sz = b.size;
        ctx.save();
        ctx.globalAlpha = vis;
        ctx.translate(x, y);
        ctx.scale(dir, 1);
        ctx.rotate(-0.25);
        const light = U.mix(b.c, [255, 255, 255], 0.45);
        [[-1, 0], [1, 0]].forEach(([sd]) => {
          ctx.save();
          ctx.scale(sd * flap, 1);
          ctx.fillStyle = css(b.c);
          ctx.beginPath();
          ctx.ellipse(sz * 0.55, -sz * 0.35, sz * 0.62, sz * 0.48, -0.5, 0, TAU);
          ctx.fill();
          ctx.fillStyle = css(light);
          ctx.beginPath();
          ctx.ellipse(sz * 0.5, -sz * 0.38, sz * 0.28, sz * 0.2, -0.5, 0, TAU);
          ctx.fill();
          ctx.fillStyle = css(U.mix(b.c, [0, 0, 0], 0.15));
          ctx.beginPath();
          ctx.ellipse(sz * 0.42, sz * 0.3, sz * 0.36, sz * 0.28, 0.4, 0, TAU);
          ctx.fill();
          ctx.restore();
        });
        ctx.fillStyle = '#3A2E2A';
        ctx.beginPath();
        ctx.ellipse(0, 0, sz * 0.1, sz * 0.48, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }

    /* A bluebird: flies in, perches on a pad, hops and chirps, flies off. */
    function perchPoint() {
      const grown = tree.pads.filter(pd => pd.puffs.some(q => q.bornAt != null));
      if (!grown.length) return null;
      const pad = grown[Math.floor(rnd() * grown.length)];
      const top = pad.puffs.reduce((a, q) => (q.bornAt != null && q.y - q.r < a.y - a.r ? q : a), pad.puffs.find(q => q.bornAt != null));
      return { pad, dx: clamp(top.x, -pad.w * 0.5, pad.w * 0.5), dy: top.y - top.r * 0.9 };
    }
    function perchScreen(pc) {
      const fill = 1 + 0.1 * span(lastP, pc.pad.birth + 0.12, 0.88, ease.outQuad);
      const y = pc.pad.cy + pc.dy * fill;
      return { x: sx(pc.pad.cx + pc.dx * fill, y), y: sy(y) };
    }
    function drawBird(c, p, t) {
      if (reduce) return;
      const day = p > 0.06 && p < 0.84;
      if (!bird.next) bird.next = t + R(16, 26);
      if (bird.state === 'away' && ((t > bird.next && day) || bird.force)) {
        bird.force = false;
        const pc = perchPoint();
        if (!pc) { bird.next = t + 10; return; }
        const from = rnd() < 0.5 ? -1 : 1;
        bird.perch = pc;
        bird.state = 'in';
        bird.t0 = t;
        bird.from = { x: from < 0 ? -40 : W + 40, y: G.soilY - G.scale * R(0.9, 1.3) };
        bird.facing = from < 0 ? 1 : -1;
        bird.hop = 0;
        bird.hopAt = t + 2.6 + R(1.2, 2.2);
        bird.chirpAt = t + 2.6 + R(0.8, 1.6);
        bird.leaveAt = t + 2.6 + R(8, 13);
      }
      if (bird.state === 'away') return;
      const home = perchScreen(bird.perch);
      let x;
      let y;
      let flying = true;
      if (bird.state === 'in') {
        const k = clamp((t - bird.t0) / 2.6, 0, 1);
        const e = ease.inOutCubic(k);
        const cx_ = (bird.from.x + home.x) / 2;
        const cy_ = Math.min(bird.from.y, home.y) - G.scale * 0.35;
        x = (1 - e) * (1 - e) * bird.from.x + 2 * (1 - e) * e * cx_ + e * e * home.x;
        y = (1 - e) * (1 - e) * bird.from.y + 2 * (1 - e) * e * cy_ + e * e * home.y;
        if (k >= 1) bird.state = 'perched';
      } else if (bird.state === 'perched') {
        flying = false;
        if (t > bird.hopAt) {
          bird.hop = t;
          bird.hopAt = t + R(1.6, 3.2);
          if (rnd() < 0.4) bird.facing *= -1;
        }
        const hk = clamp((t - bird.hop) / 0.32, 0, 1);
        x = home.x;
        y = home.y - Math.sin(hk * Math.PI) * G.scale * 0.03;
        if (t > bird.chirpAt) {
          fx.notes.push({ t0: t, x: x + bird.facing * G.scale * 0.03, y: y - G.scale * 0.05 });
          bird.chirpAt = t + R(2.5, 4.5);
        }
        if (t > bird.leaveAt || !day) {
          bird.state = 'out';
          bird.t0 = t;
          bird.from = { x, y };
          bird.facing = rnd() < 0.5 ? -1 : 1;
        }
      } else {
        const k = clamp((t - bird.t0) / 2.4, 0, 1);
        const e = ease.inOutCubic(k);
        const tx = bird.facing > 0 ? W + 50 : -50;
        const ty = bird.from.y - G.scale * 0.9;
        x = lerp(bird.from.x, tx, e);
        y = lerp(bird.from.y, ty, e) - Math.sin(e * Math.PI) * G.scale * 0.15;
        if (k >= 1) {
          bird.state = 'away';
          bird.next = t + R(45, 90);
          return;
        }
      }
      const sz = clamp(G.scale * 0.078, 15, 28);
      const body = U.mix([58, 111, 208], [30, 40, 70], c.night * 0.7);
      const belly = U.mix([246, 185, 138], [80, 70, 80], c.night * 0.7);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(bird.facing, 1);
      // tail
      ctx.fillStyle = css(U.mix(body, [0, 0, 0], 0.15));
      ctx.beginPath();
      ctx.moveTo(-sz * 0.55, -sz * 0.05);
      ctx.lineTo(-sz * 1.05, -sz * 0.28);
      ctx.lineTo(-sz * 0.95, sz * 0.08);
      ctx.closePath();
      ctx.fill();
      // body and belly
      ctx.fillStyle = css(body);
      ctx.beginPath();
      ctx.ellipse(0, 0, sz * 0.62, sz * 0.46, -0.15, 0, TAU);
      ctx.fill();
      ctx.fillStyle = css(belly);
      ctx.beginPath();
      ctx.ellipse(sz * 0.16, sz * 0.15, sz * 0.4, sz * 0.27, -0.2, 0, TAU);
      ctx.fill();
      // head, eye, beak
      ctx.fillStyle = css(body);
      ctx.beginPath();
      ctx.arc(sz * 0.42, -sz * 0.36, sz * 0.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(sz * 0.52, -sz * 0.42, sz * 0.09, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1A1A22';
      ctx.beginPath();
      ctx.arc(sz * 0.545, -sz * 0.42, sz * 0.055, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#F2A33A';
      ctx.beginPath();
      ctx.moveTo(sz * 0.68, -sz * 0.38);
      ctx.lineTo(sz * 0.9, -sz * 0.32);
      ctx.lineTo(sz * 0.68, -sz * 0.26);
      ctx.closePath();
      ctx.fill();
      // wing: flapping in flight, tucked when perched
      ctx.fillStyle = css(U.mix(body, [255, 255, 255], 0.12));
      ctx.beginPath();
      if (flying) {
        const f = Math.sin(t * 22);
        ctx.ellipse(-sz * 0.05, -sz * 0.1 - f * sz * 0.35, sz * 0.42, sz * 0.18, -0.4 - f * 0.6, 0, TAU);
      } else {
        ctx.ellipse(-sz * 0.08, -sz * 0.02, sz * 0.38, sz * 0.22, -0.25, 0, TAU);
      }
      ctx.fill();
      if (!flying) {
        ctx.strokeStyle = '#6A4A30';
        ctx.lineWidth = Math.max(1, sz * 0.06);
        ctx.beginPath();
        ctx.moveTo(0, sz * 0.4); ctx.lineTo(-sz * 0.05, sz * 0.58);
        ctx.moveTo(sz * 0.14, sz * 0.4); ctx.lineTo(sz * 0.12, sz * 0.58);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawNotes(t) {
      for (let i = fx.notes.length - 1; i >= 0; i--) {
        const n = fx.notes[i];
        const k = (t - n.t0) / 1.6;
        if (k > 1) { fx.notes.splice(i, 1); continue; }
        const x = n.x + Math.sin(k * 7) * 3;
        const y = n.y - k * 26;
        const a = Math.sin(Math.PI * k);
        const sz = clamp(G.scale * 0.03, 6, 11);
        ctx.save();
        ctx.globalAlpha = a * 0.85;
        ctx.fillStyle = '#2F3A68';
        ctx.strokeStyle = '#2F3A68';
        ctx.lineWidth = Math.max(1, sz * 0.18);
        ctx.beginPath();
        ctx.ellipse(x, y, sz * 0.42, sz * 0.32, -0.4, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + sz * 0.36, y - sz * 0.05);
        ctx.lineTo(x + sz * 0.36, y - sz * 1.3);
        ctx.quadraticCurveTo(x + sz * 0.9, y - sz * 1.0, x + sz * 0.8, y - sz * 0.6);
        ctx.stroke();
        ctx.restore();
      }
    }

    function drawOwl(c, p, t) {
      const vis = span(p, 0.94, 0.975);
      if (vis <= 0.01 || reduce || !tree.pads.length) return;
      if (!owl.perch) {
        const low = tree.pads.filter(pd => !pd.apex && pd.w > 0.12);
        const pad = low[low.length - 1] || tree.pads[0];
        owl.perch = { pad, dx: pad.w * 0.15 * (pad.cx > 0 ? -1 : 1), dy: -pad.h * 0.75 };
      }
      if (!owl.blinkAt) owl.blinkAt = t + R(2, 4);
      const pos = perchScreen(owl.perch);
      const sz = clamp(G.scale * 0.095, 16, 32);
      const blink = t > owl.blinkAt && t < owl.blinkAt + 0.16;
      if (t > owl.blinkAt + 0.16) owl.blinkAt = t + R(2.5, 6);
      const tilt = Math.sin(t * 0.5) * 0.12;
      ctx.save();
      ctx.globalAlpha = vis;
      ctx.translate(pos.x, pos.y - sz * 0.55);
      ctx.rotate(tilt * 0.3);
      ctx.fillStyle = '#4E4250';
      ctx.beginPath();
      ctx.ellipse(0, 0, sz * 0.55, sz * 0.7, 0, 0, TAU);
      ctx.fill();
      // ear tufts
      ctx.beginPath();
      ctx.moveTo(-sz * 0.45, -sz * 0.45); ctx.lineTo(-sz * 0.38, -sz * 0.85); ctx.lineTo(-sz * 0.2, -sz * 0.55);
      ctx.moveTo(sz * 0.45, -sz * 0.45); ctx.lineTo(sz * 0.38, -sz * 0.85); ctx.lineTo(sz * 0.2, -sz * 0.55);
      ctx.fill();
      ctx.fillStyle = '#7A6A72';
      ctx.beginPath();
      ctx.ellipse(0, sz * 0.22, sz * 0.36, sz * 0.4, 0, 0, TAU);
      ctx.fill();
      ctx.rotate(tilt);
      ctx.fillStyle = '#B7A7A0';
      [-1, 1].forEach(sd => { ctx.beginPath(); ctx.arc(sd * sz * 0.22, -sz * 0.2, sz * 0.22, 0, TAU); ctx.fill(); });
      [-1, 1].forEach(sd => {
        const ex = sd * sz * 0.22;
        const ey = -sz * 0.2;
        if (blink) {
          ctx.strokeStyle = '#2A2028';
          ctx.lineWidth = Math.max(1, sz * 0.06);
          ctx.beginPath(); ctx.moveTo(ex - sz * 0.12, ey); ctx.lineTo(ex + sz * 0.12, ey); ctx.stroke();
        } else {
          const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, sz * 0.3);
          g.addColorStop(0, 'rgba(255,200,90,0.5)');
          g.addColorStop(1, 'rgba(255,200,90,0)');
          ctx.fillStyle = g;
          ctx.fillRect(ex - sz * 0.3, ey - sz * 0.3, sz * 0.6, sz * 0.6);
          ctx.fillStyle = '#FFC75A';
          ctx.beginPath(); ctx.arc(ex, ey, sz * 0.14, 0, TAU); ctx.fill();
          ctx.fillStyle = '#1A1218';
          ctx.beginPath(); ctx.arc(ex, ey, sz * 0.075, 0, TAU); ctx.fill();
        }
      });
      ctx.fillStyle = '#E09A3A';
      ctx.beginPath();
      ctx.moveTo(-sz * 0.05, -sz * 0.08); ctx.lineTo(sz * 0.05, -sz * 0.08); ctx.lineTo(0, sz * 0.04);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function drawFireflies(c, p, t) {
      const vis = span(p, 0.84, 0.92);
      if (vis <= 0.01) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const f of flies) {
        const x = f.x + (reduce ? 0 : Math.sin(t * f.f1 + f.ph) * f.ax + Math.sin(t * f.f1 * 2.3 + f.ph * 1.7) * f.ax * 0.3);
        const y = f.y + (reduce ? 0 : Math.sin(t * f.f2 + f.ph * 1.3) * f.ay);
        const blink = reduce ? 0.6 : Math.pow((Math.sin(t * f.blink + f.ph) + 1) / 2, 2.5);
        const a = vis * (0.25 + 0.75 * blink);
        const r = 8 * f.size;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(250,255,180,' + a.toFixed(3) + ')');
        g.addColorStop(0.25, 'rgba(210,245,120,' + (a * 0.55).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(160,230,90,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.restore();
    }

    function drawPetals(c, p, t, dt) {
      if (reduce) return;
      if (p > 0.86 && tree.blossoms.length && t > fx.nextPetal && fx.petals.length < 16) {
        const live = tree.blossoms.filter(b => b.bornAt != null);
        if (live.length) {
          const b = live[Math.floor(rnd() * live.length)];
          const y = b.pad.cy + b.y;
          fx.petals.push({ x: sx(b.pad.cx + b.x, y), y: sy(y), vy: R(14, 24), ph: R(0, TAU), rot: R(0, TAU), vr: R(-1.5, 1.5), t0: t, landed: 0,
            col: U.hex(b.alt ? tree.bloom.petal2 : tree.bloom.petal) });
        }
        fx.nextPetal = t + R(1.1, 2.6);
      }
      for (let i = fx.petals.length - 1; i >= 0; i--) {
        const q = fx.petals[i];
        const ground = q.x > G.cx - G.scale * 0.34 && q.x < G.cx + G.scale * 0.34 ? G.soilY - 2 : G.near.at(q.x) + 3;
        if (!q.landed) {
          q.y += q.vy * dt;
          q.x += (Math.sin(t * 2 + q.ph) * 18 + windNow * 10) * dt;
          q.rot += q.vr * dt;
          if (q.y >= ground) { q.y = ground; q.landed = t; }
        }
        const fade = q.landed ? 1 - clamp((t - q.landed - 5) / 2, 0, 1) : 1;
        if (fade <= 0) { fx.petals.splice(i, 1); continue; }
        const r = clamp(G.scale * 0.012, 2.4, 5);
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.fillStyle = css(U.mix(q.col, c.leafDark, c.night * 0.4), 0.9 * fade);
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.6, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }

    /* A burst of spectrum sparkles from the crown when a segment ends. */
    function burst(t) {
      if (reduce || !G) return;
      const cx = G.cx;
      const cy = G.soilY - G.scale * 0.7;
      for (let i = 0; i < 34; i++) {
        const a = R(0, TAU);
        const sp = R(30, 120);
        fx.sparkles.push({ x: cx + Math.cos(a) * G.scale * R(0.1, 0.6), y: cy + Math.sin(a) * G.scale * R(0.05, 0.3),
          vx: Math.cos(a) * sp * 0.4, vy: -R(20, 70), t0: t + R(0, 0.35), life: R(1.6, 2.6),
          c: U.hex(U.SPECTRUM[i % U.SPECTRUM.length]), r: R(2, 4.5) });
      }
    }
    function drawSparkles(t, dt) {
      for (let i = fx.sparkles.length - 1; i >= 0; i--) {
        const s = fx.sparkles[i];
        const k = (t - s.t0) / s.life;
        if (k < 0) continue;
        if (k > 1) { fx.sparkles.splice(i, 1); continue; }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy -= 6 * dt;
        const a = Math.sin(Math.PI * k);
        const r = s.r * (0.6 + 0.4 * Math.sin(k * 20));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = css(s.c, a);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - r * 2);
        ctx.quadraticCurveTo(s.x, s.y, s.x + r * 2, s.y);
        ctx.quadraticCurveTo(s.x, s.y, s.x, s.y + r * 2);
        ctx.quadraticCurveTo(s.x, s.y, s.x - r * 2, s.y);
        ctx.quadraticCurveTo(s.x, s.y, s.x, s.y - r * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    function drawVignette(c) {
      const g = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.78);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(10,8,30,' + (0.16 + 0.26 * c.night).toFixed(3) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    /* The page's ink follows the sky, so the time is readable from dawn to midnight. */
    function updateVars(c) {
      const glassTint = U.mix([255, 253, 245], [16, 20, 46], span(c.night, 0.35, 0.85));
      const key = [c.ink, c.ink2, c.ink3, c.onInk, glassTint].map(U.toHex).join('') + c.glass.toFixed(2);
      if (key === lastVars) return;
      lastVars = key;
      const onInk = c.onInk;
      api.setVars({
        '--scene-ink': css(c.ink),
        '--scene-ink-2': css(c.ink2),
        '--scene-ink-3': css(c.ink3),
        '--scene-on-ink': css(onInk),
        '--scene-line': css(c.ink, 0.16),
        '--scene-glass': css(glassTint, c.glass + 0.12),
        '--scene-glass-line': css(U.mix([255, 255, 255], glassTint, 0.3), 0.32 - 0.18 * c.night),
        '--scene-halo': css(onInk, 0.42),
        '--scene-sky': 'linear-gradient(180deg,' + css(c.skyTop) + ',' + css(c.skyMid) + ' 60%,' + css(c.skyLow) + ')'
      });
    }

    /* ── Segment changes: a new tree, a new dawn ───────────────── */
    function checkTree(t, p) {
      const key = keyOverride || api.segmentKey();
      if (key === treeKey && tree) return false;
      const first = !tree;
      if (!first && !reduce && canvas.width > 0) {
        // Keep the last frame of the old day and fade it out over the new dawn.
        if (!snapshot) snapshot = document.createElement('canvas');
        snapshot.width = canvas.width;
        snapshot.height = canvas.height;
        snapshot.getContext('2d').drawImage(canvas, 0, 0);
        fadeStart = t;
        fadeDur = lastP > 0.97 ? 2.6 : 1.3;
      }
      treeKey = key;
      tree = buildTree(U.hash(key));
      face.yawned = false;
      owl.perch = null;
      bird.state = 'away';
      bird.next = t + R(14, 24);
      fx.petals.length = 0;
      return true;
    }

    const offSegmentEnd = api.on('segmentEnd', () => burst(lastT));

    /* ── The frame ─────────────────────────────────────────────── */
    function frame(t, dt) {
      if (!G) relayout();
      if (started === null) started = t;
      lastT = t;
      const p = debugState.progress != null ? debugState.progress : api.progress();
      const fresh = checkTree(t, p);
      // A big jump in progress (a jump, an edit, the first frame) shows growth at once, without a pop storm.
      const instant = fresh || lastP < 0 || Math.abs(p - lastP) > 0.01;
      windNow = reduce ? 0 : 0.55 * Math.sin(t * 0.62) + 0.3 * Math.sin(t * 1.37 + 1.1) + 0.15 * Math.sin(t * 2.9 + 0.3);
      pal = paletteAt(p);
      const c = pal;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawSky(c);
      drawStars(c, t);
      drawMoon(c, p, t);
      drawSun(c, p, t);
      drawClouds(c, dt, false);
      drawClouds(c, dt, true);
      drawLand(c, t, dt);
      drawPot(c, p, t);
      drawTree(c, p, t, instant); // with the sprout, roots, moss and toadstool at its foot
      drawGrass(c, t);
      drawButterflies(c, p, t);
      drawBird(c, p, t);
      drawNotes(t);
      drawOwl(c, p, t);
      drawPetals(c, p, t, dt);
      drawFireflies(c, p, t);
      drawSparkles(t, dt);
      drawVignette(c);

      let holdInk = false;
      if (snapshot) {
        const k = (t - fadeStart) / fadeDur;
        if (k >= 1) snapshot = null;
        else {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalAlpha = 1 - ease.inOutSine(clamp(k, 0, 1));
          ctx.drawImage(snapshot, 0, 0);
          ctx.globalAlpha = 1;
          holdInk = k < 0.5; // the text follows the sky once the new dawn is half in
        }
      }
      lastP = p;
      if (!holdInk) updateVars(c);
    }

    return {
      resize(w, h, ratio) {
        dpr = ratio;
        relayout();
      },
      relayout() { relayout(); },
      frame,
      destroy() {
        snapshot = null;
        if (offSegmentEnd) offSegmentEnd();
      },
      /* For the dev lab and screenshots */
      debug: {
        setProgress(v) { debugState.progress = v == null ? null : clamp(v, 0, 1); },
        bird() { bird.state = 'away'; bird.force = true; },
        sunFace(kind) { face.anim = { kind: kind || 'peek', t0: lastT, dur: kind === 'yawn' ? 5.2 : 5.6 }; },
        burst() { burst(lastT); },
        reseed(key) { keyOverride = key || 'lab-' + Math.random().toString(36).slice(2, 8); },
        geometry() { return G ? { cx: G.cx, soilY: G.soilY, scale: G.scale, dpr } : null; }
      }
    };
  });
})(window.JP = window.JP || {});
