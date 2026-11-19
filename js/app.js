/* ═══════════════════════════════════════════════════════════════
   JoyPro Timer Reloaded · app.js
   Start-up, keyboard shortcuts, the screen wake lock, and the
   Growing Tree lab (add ?lab to the address to scrub through a day).
   ═══════════════════════════════════════════════════════════════ */
(function (JP) {
  'use strict';

  const U = JP.util;
  const S = JP.store;
  const E = JP.engine;
  const A = JP.actions;
  const ui = JP.ui;

  /* ── Keyboard ──────────────────────────────────────────────── */
  let swallowSpaceUp = false;

  function onKeyDown(e) {
    if (e.defaultPrevented) return;
    const t = e.target;
    const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

    if (e.key === 'Escape') {
      if (ui.anyDialogOpen()) return; // dialogs close themselves
      if (ui.themeMenuOpen()) { ui.closeThemeMenu(true); e.preventDefault(); return; }
      if (ui.isSheetOpen()) { ui.closeSheet(); e.preventDefault(); }
      return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === '?') {
      if (!ui.anyDialogOpen()) { e.preventDefault(); ui.openHelp(); }
      return;
    }
    if (e.shiftKey) return;

    // M works even with a dialog open, as it did in the original.
    if (e.code === 'KeyM') {
      const r = A.toggleMute();
      ui.toast(r.muted ? 'Sound muted' : 'Sound on');
      return;
    }
    if (ui.anyDialogOpen()) return;

    if (e.code === 'Space') {
      // A keyboard-focused button keeps Space for itself; otherwise Space is play/pause.
      const btn = t && t.closest && t.closest('button, a, summary, [role="button"], [role="menuitemradio"]');
      if (btn && btn.matches(':focus-visible')) return;
      e.preventDefault();
      if (btn) btn.blur();
      swallowSpaceUp = true;
      A.toggle();
      return;
    }
    if (e.repeat) return;
    switch (e.code) {
      case 'KeyN': e.preventDefault(); ui.next(); break;
      case 'KeyR': e.preventDefault(); ui.reset(); break;
      case 'KeyE': e.preventDefault(); if (ui.isSheetOpen()) ui.closeSheet(); else ui.openSheet(); break;
      case 'KeyP': e.preventDefault(); ui.togglePopout(); break;
      default: break;
    }
  }

  function onKeyUp(e) {
    if (e.code === 'Space' && swallowSpaceUp) {
      e.preventDefault();
      swallowSpaceUp = false;
    }
  }

  /* ── Mute button ───────────────────────────────────────────── */
  function syncMute() {
    const b = U.$('#muteBtn');
    const muted = S.state.muted;
    b.setAttribute('aria-pressed', String(muted));
    b.setAttribute('aria-label', muted ? 'Unmute sound (M)' : 'Mute sound (M)');
    b.dataset.tip = muted ? 'Sound off · M' : 'Sound on · M';
  }

  /* ── Keep the screen awake while the timer runs ────────────── */
  // `wanted` is the truth; a request still in flight checks it when it lands,
  // so a quick play-pause can't leave the screen held awake.
  let wakeLock = null;
  let wanted = false;
  let requesting = false;
  async function wantAwake(on) {
    wanted = on;
    if (on && !wakeLock && !requesting && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      requesting = true;
      try {
        const lock = await navigator.wakeLock.request('screen');
        requesting = false;
        if (!wanted) { lock.release().catch(() => {}); return; }
        wakeLock = lock;
        lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; });
      } catch (e) {
        requesting = false;
      }
    } else if (!on && wakeLock) {
      const lock = wakeLock;
      wakeLock = null;
      try { await lock.release(); } catch (e) { /* already gone */ }
    }
  }

  /* ── The Growing Tree lab: index.html?lab ──────────────────── */
  function startLab() {
    const panel = document.createElement('div');
    panel.className = 'lab';
    panel.innerHTML =
      '<style>' +
      '.lab{position:fixed;left:14px;top:64px;z-index:40;width:270px;padding:12px 14px;border-radius:14px;background:rgba(20,22,30,.82);color:#f2ede4;font:13px/1.4 var(--font-ui);backdrop-filter:blur(10px);box-shadow:0 12px 30px rgba(0,0,0,.35)}' +
      '.lab b{display:block;margin-bottom:6px;letter-spacing:.12em;text-transform:uppercase;font-size:11px;opacity:.7}' +
      '.lab input[type=range]{width:100%}' +
      '.lab .row{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}' +
      '.lab button{border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:inherit;border-radius:8px;padding:4px 9px;font:inherit;cursor:pointer}' +
      '.lab button:hover{background:rgba(255,255,255,.18)}' +
      '</style>' +
      '<b>Growing Tree lab</b>' +
      '<div>Time of day: <span id="labP">live</span></div>' +
      '<input id="labRange" type="range" min="0" max="1000" value="0" aria-label="Progress through the segment">' +
      '<div class="row"><button id="labLive">Live</button><button id="labPlay">Play day (60 s)</button><button id="labSeed">New tree</button></div>' +
      '<div class="row"><button id="labBird">Bird</button><button id="labPeek">Sun peek</button><button id="labYawn">Yawn</button><button id="labBurst">Sparkle</button></div>';
    document.body.appendChild(panel);
    const scene = () => {
      const sc = ui.currentScene();
      return sc && sc.debug ? sc.debug : null;
    };
    const range = U.$('#labRange');
    const label = U.$('#labP');
    let playing = null;
    const set = v => {
      const d = scene();
      if (d) d.setProgress(v);
      label.textContent = v == null ? 'live' : Math.round(v * 100) + '%';
    };
    range.addEventListener('input', () => { cancelAnimationFrame(playing); playing = null; set(range.value / 1000); });
    U.$('#labLive').addEventListener('click', () => { cancelAnimationFrame(playing); playing = null; set(null); });
    U.$('#labPlay').addEventListener('click', () => {
      cancelAnimationFrame(playing);
      const t0 = performance.now();
      const step = now => {
        const v = Math.min(1, (now - t0) / 60000);
        range.value = String(Math.round(v * 1000));
        set(v);
        if (v < 1) playing = requestAnimationFrame(step);
      };
      playing = requestAnimationFrame(step);
    });
    U.$('#labSeed').addEventListener('click', () => { const d = scene(); if (d) d.reseed(); });
    U.$('#labBird').addEventListener('click', () => { const d = scene(); if (d) d.bird(); });
    U.$('#labPeek').addEventListener('click', () => { const d = scene(); if (d) d.sunFace('peek'); });
    U.$('#labYawn').addEventListener('click', () => { const d = scene(); if (d) d.sunFace('yawn'); });
    U.$('#labBurst').addEventListener('click', () => { const d = scene(); if (d) d.burst(); });
    const params = new URLSearchParams(location.search);
    const p0 = parseFloat(params.get('p'));
    if (p0 >= 0 && p0 <= 1) {
      range.value = String(Math.round(p0 * 1000));
      setTimeout(() => set(p0), 60);
    }
  }

  /* ── Start ─────────────────────────────────────────────────── */
  async function start() {
    const app = U.$('#app');
    const params = new URLSearchParams(location.search);
    const { migrated } = S.load();

    ui.initStage();
    ui.initRibbon();
    ui.initSheet();
    ui.initLibrary();
    ui.initThemes();
    ui.initPopout();
    ui.initIntro();

    U.$('#muteBtn').addEventListener('click', () => {
      const r = A.toggleMute();
      ui.toast(r.muted ? 'Sound muted' : 'Sound on');
    });
    syncMute();
    S.on('settings', d => { if (d && 'muted' in d) syncMute(); });

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    S.on('run', r => wantAwake(r));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && E.isRunning()) wantAwake(true);
    });

    if (!U.reducedMotion()) {
      app.classList.add('is-entering');
      setTimeout(() => app.classList.remove('is-entering'), 1400);
    }

    if (params.has('lab')) startLab();

    let soundInfo = { migrated: 0 };
    try { soundInfo = await JP.sounds.init(); } catch (e) { /* sounds are optional */ }

    if (migrated) ui.toast('Your sessions came over from the original JoyPro Timer', 'success');
    if (soundInfo.migrated) ui.toast('Moved ' + soundInfo.migrated + ' custom sound' + (soundInfo.migrated === 1 ? '' : 's') + ' into the Sound Library', 'success');
    if (!S.flags.onboarded() && !params.has('lab') && !params.has('notour')) setTimeout(ui.openIntro, 900);
  }

  start();
})(window.JP = window.JP || {});
