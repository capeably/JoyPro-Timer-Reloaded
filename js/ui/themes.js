/* ═══════════════════════════════════════════════════════════════
   JoyPro Timer Reloaded · themes.js
   The theme menu, the global theme plus per-segment overrides, and
   the scene manager that runs animated themes on the #scene canvas.

   A scene registers itself with JP.scenes.register(key, factory).
   factory(canvas, api) returns { resize(w, h, dpr), frame(t, dt),
   destroy() }. The api gives it the timer's progress, a seed for
   the current segment, the page layout, and a way to set CSS vars.
   ═══════════════════════════════════════════════════════════════ */
(function (JP) {
  'use strict';

  const U = JP.util;
  const S = JP.store;
  const E = JP.engine;
  const A = JP.actions;
  const ui = (JP.ui = JP.ui || {});

  const html = document.documentElement;
  const canvas = U.$('#scene');
  const menu = U.$('#themeMenu');
  const themeBtn = U.$('#themeBtn');
  const note = U.$('#themeNote');

  const factories = {};
  JP.scenes = { register: (key, factory) => { factories[key] = factory; } };

  let applied = null;   // theme key currently shown
  let scene = null;     // the running scene object
  let sceneKey = null;
  let targetKey = null; // the scene we're showing or fading toward
  let swapToken = 0;
  let raf = 0;
  let lastT = 0;
  let size = { w: 0, h: 0, dpr: 1 };
  const sceneVars = new Set();

  /* What a scene can ask of the app. */
  const api = {
    progress: () => E.progress(),
    running: () => E.isRunning(),
    completed: () => E.isCompleted(),
    segmentKey: () => {
      const ses = S.activeSession();
      const seg = S.activeSegment();
      return (ses ? ses.id : '') + ':' + (seg ? seg.id : '') + ':' + S.state.segmentIndex;
    },
    layout: () => {
      const clock = U.$('#clockWrap').getBoundingClientRect();
      const controls = U.$('#controls').getBoundingClientRect();
      const dock = U.$('#dock').getBoundingClientRect();
      return {
        clockBottom: clock.bottom,
        textBottom: Math.max(clock.bottom, controls.bottom || clock.bottom),
        dockTop: dock.top,
        w: window.innerWidth,
        h: window.innerHeight
      };
    },
    reducedMotion: () => U.reducedMotion(),
    setVars: vars => {
      Object.keys(vars).forEach(k => {
        sceneVars.add(k);
        html.style.setProperty(k, vars[k]);
      });
    },
    on: (type, fn) => S.on(type, fn)
  };

  function clearSceneVars() {
    sceneVars.forEach(k => html.style.removeProperty(k));
    sceneVars.clear();
  }

  /* ── Canvas sizing ─────────────────────────────────────────── */
  function measure() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Keep the backing store under ~6 megapixels on big, dense screens.
    const budget = 6e6;
    if (w * h * dpr * dpr > budget) dpr = Math.max(1, Math.sqrt(budget / (w * h)));
    return { w, h, dpr };
  }

  function resize() {
    size = measure();
    canvas.width = Math.round(size.w * size.dpr);
    canvas.height = Math.round(size.h * size.dpr);
    if (scene && scene.resize) scene.resize(size.w, size.h, size.dpr);
  }

  /* ── The frame loop (only while a scene is up) ─────────────── */
  function loop(ms) {
    raf = requestAnimationFrame(loop);
    const t = ms / 1000;
    const dt = lastT ? Math.min(0.1, t - lastT) : 1 / 60;
    lastT = t;
    if (scene) {
      try { scene.frame(t, dt); }
      catch (e) { console.error('[JoyPro] scene frame failed', e); stopScene(); }
    }
  }
  function startLoop() {
    if (!raf) { lastT = 0; raf = requestAnimationFrame(loop); }
  }
  function stopLoop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function stopScene() {
    if (scene && scene.destroy) {
      try { scene.destroy(); } catch (e) { /* ignore */ }
    }
    scene = null;
    sceneKey = null;
    stopLoop();
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  /**
   * Fade the canvas out, swap scenes, fade back in. Quick back-and-forth
   * changes (A → B → A inside the fade) cancel the pending swap instead of
   * racing it: the target, not the running scene, decides what's next.
   */
  function swapScene(key) {
    if (key === targetKey) return;
    targetKey = key;
    const token = ++swapToken;
    if (scene && sceneKey === key) {
      // Heading back to the scene that's still running: just bring it back up.
      canvas.classList.add('is-on');
      return;
    }
    const hadScene = !!scene;
    canvas.classList.remove('is-on');
    const go = () => {
      if (token !== swapToken) return;
      stopScene();
      clearSceneVars();
      const factory = factories[key];
      if (!factory) return;
      resize();
      try {
        scene = factory(canvas, api);
        sceneKey = key;
        scene.resize(size.w, size.h, size.dpr);
        scene.frame(performance.now() / 1000, 1 / 60);
      } catch (e) {
        console.error('[JoyPro] scene failed to start', e);
        scene = null;
        sceneKey = null;
        return;
      }
      startLoop();
      requestAnimationFrame(() => { if (token === swapToken) canvas.classList.add('is-on'); });
    };
    if (hadScene) setTimeout(go, U.reducedMotion() ? 0 : 420);
    else go();
  }

  /* ── Applying a theme ──────────────────────────────────────── */
  function apply() {
    const key = S.effectiveTheme();
    if (key === applied) { updateMenu(); return; }
    const theme = S.THEMES.find(t => t.key === key) || S.THEMES[3];
    applied = key;
    html.dataset.theme = theme.key;
    html.dataset.mode = theme.mode;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(html).getPropertyValue('--bg').trim();
    swapScene(theme.key);
    updateMenu();
    // Fraunces' axes change per theme; the digit slots must follow.
    setTimeout(() => ui.measureDigits && ui.measureDigits(), 760);
  }
  ui.applyTheme = apply;
  ui.currentScene = () => scene;

  /* ── Menu ──────────────────────────────────────────────────── */
  // With the Popover API the button opens the menu declaratively (popovertarget),
  // so a second click closes it instead of light-dismissing and reopening it.
  const canPopover = typeof menu.showPopover === 'function';
  if (!canPopover) {
    menu.removeAttribute('popover');
    themeBtn.removeAttribute('popovertarget');
    menu.classList.add('is-fallback');
  }
  const menuOpen = () => (canPopover ? menu.matches(':popover-open') : menu.classList.contains('is-open'));

  function updateMenu() {
    U.$$('.theme-opt', menu).forEach(b => b.setAttribute('aria-checked', String(b.dataset.theme === S.state.theme)));
    const seg = S.activeSegment();
    const override = seg && seg.theme && seg.theme !== 'default' && seg.theme !== S.state.theme;
    if (override) {
      const t = S.THEMES.find(x => x.key === seg.theme);
      note.textContent = '“' + seg.title + '” uses ' + (t ? t.label : seg.theme) + '. Change that in Edit session.';
    }
    note.hidden = !override;
  }

  function placeMenu() {
    const r = themeBtn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = Math.round(r.bottom + 8) + 'px';
    menu.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + 'px';
    menu.style.left = 'auto';
    menu.style.bottom = 'auto';
  }

  function openMenu() {
    updateMenu();
    placeMenu();
    if (canPopover) { try { menu.showPopover(); } catch (e) { /* already open */ } }
    else menu.classList.add('is-open');
    themeBtn.setAttribute('aria-expanded', 'true');
    const checked = menu.querySelector('[aria-checked="true"]') || menu.querySelector('.theme-opt');
    if (checked) checked.focus();
  }
  function closeMenu(restoreFocus) {
    if (canPopover) { try { menu.hidePopover(); } catch (e) { /* already closed */ } }
    else menu.classList.remove('is-open');
    themeBtn.setAttribute('aria-expanded', 'false');
    if (restoreFocus) themeBtn.focus();
  }
  ui.closeThemeMenu = closeMenu;
  ui.themeMenuOpen = menuOpen;

  ui.initThemes = () => {
    if (canPopover) {
      menu.addEventListener('beforetoggle', e => {
        if (e.newState === 'open') { updateMenu(); placeMenu(); }
      });
      menu.addEventListener('toggle', e => {
        const isOpen = e.newState === 'open';
        themeBtn.setAttribute('aria-expanded', String(isOpen));
        if (isOpen) {
          const checked = menu.querySelector('[aria-checked="true"]') || menu.querySelector('.theme-opt');
          if (checked) checked.focus();
        }
      });
    } else {
      themeBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (menuOpen()) closeMenu(false);
        else openMenu();
      });
      document.addEventListener('click', e => {
        if (menuOpen() && !menu.contains(e.target) && !themeBtn.contains(e.target)) closeMenu(false);
      });
    }
    menu.addEventListener('click', e => {
      const b = e.target.closest('.theme-opt');
      if (!b) return;
      A.setTheme(b.dataset.theme);
      closeMenu(true);
    });
    menu.addEventListener('keydown', e => {
      const items = U.$$('.theme-opt', menu);
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next].focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeMenu(true);
      }
    });

    S.on('settings', d => { if (d && 'theme' in d) apply(); });
    S.on('position', apply);
    S.on('segments', apply);

    window.addEventListener('resize', () => {
      resize();
      if (menuOpen()) placeMenu();
    });
    // The stage and dock change size (fonts loading, ribbon collapsing): scenes re-lay out.
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => { if (scene && scene.relayout) scene.relayout(); });
      ro.observe(U.$('#stage'));
      ro.observe(U.$('#dock'));
    }
    document.addEventListener('visibilitychange', () => { lastT = 0; });

    apply();
  };
})(window.JP = window.JP || {});
