/* ═══════════════════════════════════════════════════════════════
   JoyPro Timer Reloaded · popout.js
   The mini timer. Where the browser supports Document Picture-in-
   Picture (Chrome, Edge), it floats above every other window,
   which is what a shared coworking timer needs; elsewhere it opens
   as a small popup like the original's. Unlike the original's, it
   has play/pause and skip buttons, and follows the live theme.
   ═══════════════════════════════════════════════════════════════ */
(function (JP) {
  'use strict';

  const U = JP.util;
  const S = JP.store;
  const E = JP.engine;
  const A = JP.actions;
  const ui = (JP.ui = JP.ui || {});

  const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.8v12.4a1 1 0 0 0 1.5.86l10-6.2a1 1 0 0 0 0-1.72l-10-6.2a1 1 0 0 0-1.5.86z"/></svg>';
  const PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.4"/><rect x="13.5" y="5" width="4" height="14" rx="1.4"/></svg>';
  const NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 6.2v11.6a.8.8 0 0 0 1.25.66l8.4-5.8a.8.8 0 0 0 0-1.32l-8.4-5.8a.8.8 0 0 0-1.25.66z"/><rect x="17" y="5.5" width="2.6" height="13" rx="1.2"/></svg>';

  const MINI_CSS = [
    'html,body{margin:0;height:100%;}',
    'body{font-family:var(--font-ui);color:var(--ink);background:var(--scene-sky,var(--bg));overflow:hidden;-webkit-font-smoothing:antialiased;}',
    'html[data-theme="starryNight"] body{background:linear-gradient(180deg,#0b0e2a 0%,#1a1040 40%,#0d1137 100%);}',
    'html[data-theme="light"] body{background:radial-gradient(120% 80% at 50% 115%,rgba(240,162,63,.16),transparent 60%),var(--bg);}',
    'html[data-theme="dark"] body{background:radial-gradient(120% 80% at 50% 115%,rgba(47,112,201,.2),transparent 60%),var(--bg);}',
    '.mini{box-sizing:border-box;height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;gap:6px;padding:10px 14px 12px;}',
    '.mini-top{display:flex;align-items:center;gap:8px;min-width:0;font-family:var(--font-display);font-style:italic;font-weight:var(--title-wght);font-variation-settings:"SOFT" var(--title-soft);font-size:min(7vw,15vh,24px);line-height:1.2;}',
    '.mini-title{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}',
    '.mini-dot{flex-shrink:0;width:9px;height:9px;border-radius:50%;background:var(--seg-color,var(--sp-1));opacity:.45;}',
    '.is-running .mini-dot{opacity:1;animation:pulse 1.6s ease-in-out infinite;}',
    '@keyframes pulse{50%{opacity:.35;transform:scale(.8);}}',
    '.mini-time{display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:var(--clock-wght);font-variation-settings:"SOFT" var(--clock-soft),"WONK" var(--clock-wonk);font-size:min(25vw,44vh);line-height:1;letter-spacing:-.01em;font-variant-numeric:tabular-nums lining-nums;text-shadow:0 0 .3em var(--halo);}',
    '.is-paused .mini-time{animation:dim 2.2s ease-in-out infinite;}',
    '@keyframes dim{50%{opacity:.55;}}',
    '.mini-ribbon{display:flex;gap:2px;height:5px;}',
    '.mini-ribbon span{flex:var(--w) 1 0;min-width:3px;position:relative;overflow:hidden;border-radius:3px;background:color-mix(in srgb,var(--c) 28%,transparent);}',
    '.mini-ribbon i{position:absolute;inset:0;background:var(--c);transform-origin:left;transform:scaleX(var(--p,0));}',
    '.mini-controls{display:flex;justify-content:center;gap:10px;}',
    '.mini-btn{width:36px;height:36px;display:grid;place-items:center;border-radius:50%;border:1px solid color-mix(in srgb,var(--ink) 25%,transparent);background:transparent;color:var(--ink);cursor:pointer;padding:0;}',
    '.mini-btn:hover{background:color-mix(in srgb,var(--ink) 10%,transparent);}',
    '.mini-btn.main{background:var(--ink);color:var(--on-ink);border:0;}',
    '.mini-btn svg{width:17px;height:17px;fill:currentColor;}',
    '.mini-btn.is-arming{background:var(--sp-3);color:#fff;border-color:transparent;}',
    '.mini-note{position:fixed;left:0;right:0;bottom:52px;text-align:center;font-size:12px;opacity:0;transition:opacity .2s;}',
    '.mini-note.is-on{opacity:.85;}',
    '@media (max-height:150px){.mini-ribbon,.mini-controls{display:none;}.mini{grid-template-rows:auto 1fr;}}'
  ].join('\n');

  let win = null;
  let els = null;
  let ribbonSig = '';
  let lastRunning = null;

  const canPiP = () => 'documentPictureInPicture' in window;

  function close() {
    win = null;
    els = null;
    ribbonSig = '';
    lastRunning = null;
  }

  function setup(w, floating) {
    win = w;
    const doc = w.document;
    doc.title = 'JoyPro Timer';
    U.$$('link[rel="stylesheet"]').forEach(l => {
      const n = doc.createElement('link');
      n.rel = 'stylesheet';
      n.href = l.href;
      doc.head.appendChild(n);
    });
    const style = doc.createElement('style');
    style.textContent = MINI_CSS;
    doc.head.appendChild(style);
    const icon = doc.createElement('link');
    icon.rel = 'icon';
    icon.href = new URL('assets/joypro-logo.png', location.href).href;
    doc.head.appendChild(icon);

    doc.body.innerHTML =
      '<div class="mini">' +
        '<div class="mini-top"><span class="mini-dot" aria-hidden="true"></span><span class="mini-title"></span></div>' +
        '<div class="mini-time" role="timer"></div>' +
        '<div class="mini-ribbon" aria-hidden="true"></div>' +
        '<div class="mini-controls">' +
          '<button class="mini-btn main" type="button" data-act="toggle" aria-label="Start or pause">' + PLAY + '</button>' +
          '<button class="mini-btn" type="button" data-act="next" aria-label="Next segment" title="Next segment">' + NEXT + '</button>' +
        '</div>' +
        '<div class="mini-note" aria-live="polite"></div>' +
      '</div>';
    els = {
      doc,
      root: doc.documentElement,
      mini: doc.querySelector('.mini'),
      title: doc.querySelector('.mini-title'),
      time: doc.querySelector('.mini-time'),
      ribbon: doc.querySelector('.mini-ribbon'),
      toggle: doc.querySelector('[data-act="toggle"]'),
      next: doc.querySelector('[data-act="next"]'),
      note: doc.querySelector('.mini-note')
    };

    els.toggle.addEventListener('click', () => A.toggle());
    // Skipping from the mini timer can't show a dialog in the main window
    // (you may not be looking at it), so it asks for a second click instead.
    let armTimer = null;
    let armedFor = null; // the segment the first click was about
    els.next.addEventListener('click', () => {
      if (!A.canNext()) { flash('Already on the last segment'); return; }
      const cur = (S.activeSegment() || {}).id;
      const armed = els.next.classList.contains('is-arming') && armedFor === cur;
      if (!A.nextNeedsConfirm() || armed) {
        clearTimeout(armTimer);
        els.next.classList.remove('is-arming');
        armedFor = null;
        flash('');
        A.next();
        return;
      }
      // First click (or the segment moved on since): ask for a second
      armedFor = cur;
      els.next.classList.add('is-arming');
      flash('Click again to skip');
      armTimer = setTimeout(() => {
        if (els) { els.next.classList.remove('is-arming'); flash(''); }
      }, 3000);
    });
    doc.addEventListener('keydown', e => {
      if (e.code === 'Space') { e.preventDefault(); A.toggle(); }
    });
    w.addEventListener('pagehide', close);
    sync();
    ui.toast(floating ? 'Mini timer open: it floats above your other windows' : 'Mini timer open');
  }

  function flash(text) {
    if (!els) return;
    els.note.textContent = text;
    els.note.classList.toggle('is-on', !!text);
  }

  function sync() {
    if (!win) return;
    if (win.closed) { close(); return; }
    try {
      const html = document.documentElement;
      els.root.dataset.theme = html.dataset.theme;
      els.root.dataset.mode = html.dataset.mode;
      els.root.style.cssText = html.style.cssText; // scene ink, segment color
      const seg = S.activeSegment();
      const running = E.isRunning();
      const partWay = !running && !E.isCompleted() && S.state.remaining < S.state.total;
      els.title.textContent = E.isCompleted() ? 'Session complete' : seg ? seg.title : '';
      els.time.textContent = U.formatClock(S.state.remaining);
      els.time.setAttribute('aria-label', U.formatSpoken(S.state.remaining) + ' left');
      els.mini.classList.toggle('is-running', running);
      els.mini.classList.toggle('is-paused', partWay);
      if (running !== lastRunning) {
        els.toggle.innerHTML = running ? PAUSE : PLAY;
        els.toggle.setAttribute('aria-label', running ? 'Pause' : 'Start');
        lastRunning = running;
      }
      const list = S.segments();
      const sig = list.map(s => s.id + U.segSeconds(s)).join('|');
      if (sig !== ribbonSig) {
        const colors = U.segmentColors(list);
        els.ribbon.innerHTML = list.map((s, i) => '<span style="--w:' + Math.max(1, U.segSeconds(s)) + ';--c:' + colors[i] + '"><i></i></span>').join('');
        ribbonSig = sig;
      }
      const cur = S.state.segmentIndex;
      const p = E.progress();
      Array.from(els.ribbon.children).forEach((sp, i) => {
        const done = i < cur || (E.isCompleted() && i === cur);
        sp.style.setProperty('--p', done ? 1 : i === cur ? p.toFixed(4) : 0);
      });
      els.doc.title = running ? U.formatClock(S.state.remaining) + ' · ' + (seg ? seg.title : '') : 'JoyPro Timer';
    } catch (e) {
      close();
    }
  }

  ui.togglePopout = async () => {
    if (win && !win.closed) {
      try { win.focus(); } catch (e) { /* ignore */ }
      return;
    }
    if (canPiP()) {
      try {
        const pip = await window.documentPictureInPicture.requestWindow({ width: 340, height: 214 });
        setup(pip, true);
        return;
      } catch (e) { /* fall back to a popup */ }
    }
    const w = 360;
    const h = 230;
    const left = (window.screenX || 0) + window.outerWidth - w - 40;
    const top = (window.screenY || 0) + 40;
    const pop = window.open('', 'joypro_mini',
      'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top + ',toolbar=no,menubar=no,location=no,status=no,resizable=yes,scrollbars=no');
    if (!pop) { ui.toast('The mini timer was blocked: allow pop-ups for this page'); return; }
    pop.document.open();
    pop.document.write('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>JoyPro Timer</title></head><body></body></html>');
    pop.document.close();
    setup(pop, false);
  };

  ui.initPopout = () => {
    U.$('#popoutBtn').addEventListener('click', () => ui.togglePopout());
    ['tick', 'run', 'position', 'segments', 'settings', 'complete'].forEach(t => S.on(t, sync));
    // Growing Tree's colors drift between ticks while paused; keep up gently.
    setInterval(() => { if (win) sync(); }, 2000);
  };
})(window.JP = window.JP || {});
