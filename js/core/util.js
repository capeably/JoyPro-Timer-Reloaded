/* ═══════════════════════════════════════════════════════════════
   JoyPro Timer Reloaded · util.js
   Shared helpers: DOM, math, easing, time formatting, seeded
   randomness and perceptual (OKLab) color mixing.

   Every file is a classic script that hangs its API off window.JP.
   No modules, so the app runs straight from file:// (see CLAUDE.md).
   ═══════════════════════════════════════════════════════════════ */
(function (JP) {
  'use strict';

  const U = {};

  /* ── DOM ───────────────────────────────────────────────────── */
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  /** Escape text for interpolation into HTML (content and quoted attributes). */
  U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);

  U.reducedMotion = () => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  };

  /* ── Math ──────────────────────────────────────────────────── */
  U.clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.invLerp = (a, b, v) => (v - a) / (b - a);
  U.smoothstep = (e0, e1, x) => {
    const t = U.clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  U.ease = {
    linear: t => t,
    outQuad: t => 1 - (1 - t) * (1 - t),
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: (t, s) => {
      const k = s == null ? 1.70158 : s;
      const c3 = k + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + k * Math.pow(t - 1, 2);
    },
    /* A soft spring: overshoots once, settles. Used for things that "pop" into being. */
    spring: t => (t >= 1 ? 1 : 1 - Math.exp(-6.5 * t) * Math.cos(9.5 * t))
  };

  /** How far x has travelled through the window [a, b], 0..1, optionally eased. */
  U.span = (x, a, b, easeFn) => {
    const t = U.clamp((x - a) / (b - a), 0, 1);
    return easeFn ? easeFn(t) : t;
  };

  /* ── Time ──────────────────────────────────────────────────── */
  U.pad2 = n => String(n).padStart(2, '0');

  /** MM:SS, or HH:MM:SS from one hour up (same as the original app). */
  U.formatClock = secs => {
    const t = Math.max(0, Math.round(secs));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    return h > 0 ? U.pad2(h) + ':' + U.pad2(m) + ':' + U.pad2(s) : U.pad2(m) + ':' + U.pad2(s);
  };

  /** Duration as an editable field value: "25:00", "1:30:00", "0:45". */
  U.formatField = secs => {
    const t = Math.max(0, Math.round(secs));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    return h > 0 ? h + ':' + U.pad2(m) + ':' + U.pad2(s) : m + ':' + U.pad2(s);
  };

  /** Compact label: "25m", "1h 30m", "45s", "2m 30s". */
  U.formatShort = secs => {
    const t = Math.max(0, Math.round(secs));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    if (h) return h + 'h' + (m ? ' ' + m + 'm' : '');
    if (m) return m + 'm' + (s ? ' ' + s + 's' : '');
    return s + 's';
  };

  /** Human label: "25 min", "1 hr 30 min", "45 sec". */
  U.formatLong = secs => {
    const t = Math.max(0, Math.round(secs));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    const parts = [];
    if (h) parts.push(h + ' hr');
    if (m) parts.push(m + ' min');
    if (s && !h) parts.push(s + ' sec');
    return parts.length ? parts.join(' ') : '0 sec';
  };

  /** Spoken form for screen readers: "24 minutes 17 seconds". */
  U.formatSpoken = secs => {
    const t = Math.max(0, Math.round(secs));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    const part = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
    const out = [];
    if (h) out.push(part(h, 'hour'));
    if (m) out.push(part(m, 'minute'));
    if (s || !out.length) out.push(part(s, 'second'));
    return out.join(' ');
  };

  U.segSeconds = seg => (seg ? (seg.durationMinutes | 0) * 60 + (seg.durationSeconds | 0) : 0);

  /**
   * Parse a typed duration into seconds. Accepts "25" (minutes), "25:00",
   * "1:30:00", "90m", "1h30", "1h 30m", "45s", "2m30s". NaN when unreadable.
   */
  U.parseDuration = str => {
    const s = String(str || '').trim().toLowerCase();
    if (!s) return NaN;
    if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * 60);
    if (/^\d*:\d{1,2}(:\d{1,2})?$/.test(s)) {
      const p = s.split(':').map(x => parseInt(x || '0', 10));
      if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
      return p[0] * 60 + p[1];
    }
    const m = s.match(/^(?:(\d+)\s*h(?:rs?|ours?)?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?\s*(?:(\d+)\s*s(?:ec(?:onds?)?)?)?$/);
    if (m && (m[1] || m[2] || m[3])) return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
    const hm = s.match(/^(\d+)\s*h\s*(\d+)$/);
    if (hm) return +hm[1] * 3600 + +hm[2] * 60;
    return NaN;
  };

  /* ── Ids & seeded randomness ───────────────────────────────── */
  U.uid = prefix => {
    let tail;
    try {
      const b = new Uint8Array(5);
      crypto.getRandomValues(b);
      tail = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      tail = Math.random().toString(16).slice(2, 12).padEnd(10, '0');
    }
    return prefix + '_' + tail;
  };

  /** FNV-1a: a stable 32-bit hash of a string. */
  U.hash = str => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  /** mulberry32: a small, fast, seedable PRNG returning [0, 1). */
  U.rng = seed => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ── Color (sRGB ⇄ OKLab) ──────────────────────────────────── */
  /* Mixing in OKLab keeps sunsets luminous instead of muddy: a straight
     sRGB blend from orange to violet passes through gray-brown. */
  const toLinear = c => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const fromLinear = v => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
    return U.clamp(Math.round(c * 255), 0, 255);
  };

  U.hex = hex => {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  U.toHex = rgb => '#' + rgb.map(v => U.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');

  U.toLab = rgb => {
    const r = toLinear(rgb[0]), g = toLinear(rgb[1]), b = toLinear(rgb[2]);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    ];
  };

  U.fromLab = lab => {
    const l = lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2];
    const m = lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2];
    const s = lab[0] - 0.0894841775 * lab[1] - 1.291485548 * lab[2];
    const L = l * l * l, M = m * m * m, S = s * s * s;
    return [
      fromLinear(4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S),
      fromLinear(-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S),
      fromLinear(-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S)
    ];
  };

  U.lerpLab = (a, b, t) => [U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t)];
  U.mix = (rgbA, rgbB, t) => U.fromLab(U.lerpLab(U.toLab(rgbA), U.toLab(rgbB), t));

  U.css = (rgb, a) =>
    a == null || a >= 1
      ? 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')'
      : 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + Math.max(0, a).toFixed(3) + ')';

  /** WCAG relative luminance, 0..1. */
  U.luminance = rgb => {
    const [r, g, b] = rgb.map(toLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  /* ── The JoyPro spectrum ───────────────────────────────────── */
  /* Sampled from the logo's letters: lemon, amber, coral, magenta,
     violet, cobalt, teal. A session's segments take their colors
     from here in order, so a finished session paints the full logo. */
  U.SPECTRUM = ['#E9DA3B', '#F0A23F', '#EB6D45', '#D44D8D', '#8D5CC9', '#2F70C9', '#39A3B8'];
  const SPECTRUM_LAB = U.SPECTRUM.map(h => U.toLab(U.hex(h)));

  U.spectrum = t => {
    const x = U.clamp(t, 0, 1) * (SPECTRUM_LAB.length - 1);
    const i = Math.min(SPECTRUM_LAB.length - 2, Math.floor(x));
    return U.fromLab(U.lerpLab(SPECTRUM_LAB[i], SPECTRUM_LAB[i + 1], x - i));
  };

  /** Colors for each segment of a session: the spectrum at each segment's time midpoint. */
  U.segmentColors = segments => {
    const total = segments.reduce((a, s) => a + U.segSeconds(s), 0) || 1;
    let acc = 0;
    return segments.map(s => {
      const d = U.segSeconds(s);
      const mid = (acc + d / 2) / total;
      acc += d;
      return U.toHex(U.spectrum(segments.length === 1 ? 0.45 : mid));
    });
  };

  JP.util = U;
})(window.JP = window.JP || {});
