/* ═══════════════════════════════════════════════════════════════
   JoyPro Timer Reloaded · stage.js
   The stage: segment title, the rolling clock, the meter, the
   controls, the session-complete moment, the tab title and the
   session chip. Also the two direct edits: double-click the time,
   double-click the title.
   ═══════════════════════════════════════════════════════════════ */
(function (JP) {
  'use strict';

  const U = JP.util;
  const S = JP.store;
  const E = JP.engine;
  const A = JP.actions;
  const ui = (JP.ui = JP.ui || {});

  const el = {
    app: U.$('#app'),
    inner: U.$('#stageInner'),
    eyebrow: U.$('#segEyebrowText'),
    state: U.$('#segState'),
    title: U.$('#segTitle'),
    clock: U.$('#clock'),
    clockWrap: U.$('#clockWrap'),
    meter: U.$('#meter'),
    controls: U.$('#controls'),
    play: U.$('#playBtn'),
    next: U.$('#nextBtn'),
    reset: U.$('#resetBtn'),
    complete: U.$('#complete'),
    completeTitle: U.$('#completeTitle'),
    completeStats: U.$('#completeStats'),
    restart: U.$('#restartBtn'),
    chip: U.$('#sessionChip'),
    chipName: U.$('#sessionChipName')
  };

  /* The original app's six closing lines. */
  const COMPLETE_MESSAGES = [
    'Great session. Take a moment to breathe.',
    'Well done. You showed up and stayed focused.',
    'Another session in the books. Nice work.',
    'You did it. Time for a well-earned break.',
    'Focus achieved. Give yourself a moment.',
    'Session complete. Celebrate the small wins.'
  ];

  /* ── Confirmed timer moves (also used by shortcuts and the ribbon) ── */
  // The timer keeps running behind a confirm dialog. Each move remembers which
  // segment it was about, and stands down if the timer has moved on meanwhile.
  const currentId = () => (S.activeSegment() || {}).id;

  ui.next = async () => {
    if (!A.canNext()) { ui.toast('Already on the last segment'); return; }
    const from = currentId();
    if (A.nextNeedsConfirm() && !(await ui.confirm('Skip to the next segment?', { ok: 'Skip' }))) return;
    if (currentId() !== from) { ui.toast('That segment already ended'); return; }
    A.next();
  };
  ui.reset = async () => {
    if (A.resetNeedsConfirm() && !(await ui.confirm('Reset the whole session?', { ok: 'Reset' }))) return;
    A.reset();
  };
  ui.jump = async index => {
    const seg = S.segmentAt(index);
    if (!seg) return;
    if (A.jumpNeedsConfirm(index) && !(await ui.confirm('Jump to “' + seg.title + '”?', { ok: 'Jump' }))) return;
    const now = S.segments().findIndex(s => s.id === seg.id);
    if (now >= 0) A.jump(now);
  };

  /* ── The rolling clock ─────────────────────────────────────── */
  let slots = [];
  let shownText = '';
  let shownSecs = null;
  let editingClock = false;
  let cancelClockEdit = null;

  function buildClock(text) {
    el.clock.textContent = '';
    slots = [];
    for (const ch of text) {
      if (ch === ':') {
        const sep = document.createElement('span');
        sep.className = 'sep';
        sep.textContent = ':';
        sep.setAttribute('aria-hidden', 'true');
        el.clock.appendChild(sep);
        slots.push(null);
        continue;
      }
      const slot = document.createElement('span');
      slot.className = 'slot';
      slot.setAttribute('aria-hidden', 'true');
      const glyph = document.createElement('span');
      glyph.className = 'glyph';
      glyph.textContent = ch;
      slot.appendChild(glyph);
      el.clock.appendChild(slot);
      slots.push({ slot, glyph, ch });
    }
  }

  function rollTo(text, direction) {
    const still = U.reducedMotion();
    Array.from(text).forEach((ch, i) => {
      const s = slots[i];
      if (!s || s.ch === ch) return;
      const old = s.glyph;
      const glyph = document.createElement('span');
      glyph.className = 'glyph';
      glyph.textContent = ch;
      s.slot.appendChild(glyph);
      s.glyph = glyph;
      s.ch = ch;
      if (still || !glyph.animate) { old.remove(); return; }
      // Counting down, digits drop in from above; counting up, they rise.
      const d = direction < 0 ? 1 : -1;
      old.animate(
        [{ transform: 'translateY(0)', opacity: 1, filter: 'blur(0)' },
         { transform: 'translateY(' + 30 * d + '%)', opacity: 0, filter: 'blur(6px)' }],
        { duration: 460, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }
      ).onfinish = () => old.remove();
      glyph.animate(
        [{ transform: 'translateY(' + -30 * d + '%)', opacity: 0, filter: 'blur(6px)' },
         { transform: 'translateY(0)', opacity: 1, filter: 'blur(0)' }],
        { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)' }
      );
    });
  }

  function renderClock(force) {
    if (editingClock) return;
    const secs = S.state.remaining;
    const text = U.formatClock(secs);
    if (!force && text === shownText) return;
    if (force || text.length !== shownText.length || !slots.length) buildClock(text);
    else rollTo(text, shownSecs == null ? -1 : Math.sign(secs - shownSecs) || -1);
    shownText = text;
    shownSecs = secs;
    el.clock.setAttribute('aria-label', U.formatSpoken(secs) + ' left in ' + (S.activeSegment() || {}).title);
  }

  /** Each digit sits in a slot as wide as the widest digit, so nothing jiggles. */
  ui.measureDigits = () => {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:0;top:0';
    el.clock.appendChild(probe);
    let widest = 0;
    for (let d = 0; d <= 9; d++) {
      probe.textContent = String(d);
      widest = Math.max(widest, probe.getBoundingClientRect().width);
    }
    const size = parseFloat(getComputedStyle(el.clock).fontSize);
    probe.remove();
    if (widest > 0 && size > 0) {
      document.documentElement.style.setProperty('--digit-w', (widest / size + 0.015).toFixed(3) + 'em');
    }
  };

  /* ── Clock editor: double-click the time while paused ─────── */
  const CHEV_UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
  const CHEV_DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  function enterClockEdit() {
    if (editingClock) return;
    if (E.isRunning()) { ui.toast('Pause the timer to edit the time'); return; }
    if (!S.activeSegment()) return;
    editingClock = true;
    el.clock.classList.remove('is-paused');

    const start = S.state.remaining;
    const parts = [Math.floor(start / 3600), Math.floor((start % 3600) / 60), start % 60];
    const maxes = [99, 59, 59];
    const names = ['Hours', 'Minutes', 'Seconds'];
    const wrap = document.createElement('div');
    wrap.className = 'clock-edit';
    const inputs = [];

    parts.forEach((value, i) => {
      if (i) {
        const sep = document.createElement('span');
        sep.className = 'sep';
        sep.textContent = ':';
        wrap.appendChild(sep);
      }
      const col = document.createElement('div');
      col.className = 'col';
      col.innerHTML =
        '<button class="chev up" type="button" tabindex="-1" aria-label="More ' + names[i].toLowerCase() + '">' + CHEV_UP + '</button>' +
        '<input type="text" inputmode="numeric" maxlength="2" spellcheck="false" autocomplete="off" aria-label="' + names[i] + '">' +
        '<button class="chev down" type="button" tabindex="-1" aria-label="Fewer ' + names[i].toLowerCase() + '">' + CHEV_DOWN + '</button>';
      const input = col.querySelector('input');
      input.value = U.pad2(value);
      const max = maxes[i];
      const refresh = () => col.classList.toggle('is-zero', i === 0 && (parseInt(input.value, 10) || 0) === 0);
      const set = v => {
        let n = v;
        if (n > max) n = 0;
        if (n < 0) n = max;
        input.value = U.pad2(n);
        refresh();
      };
      const nudge = delta => set((parseInt(input.value, 10) || 0) + delta);

      // Chevrons: tap for ±1, hold to repeat, speeding up (as the original did).
      const hold = (btn, delta) => {
        let timer = null;
        let wait = 400;
        const stop = () => { clearTimeout(timer); timer = null; };
        const step = () => {
          nudge(delta);
          wait = Math.max(70, wait * 0.8);
          timer = setTimeout(step, wait);
        };
        btn.addEventListener('pointerdown', e => {
          e.preventDefault();
          input.focus();
          nudge(delta);
          wait = 400;
          timer = setTimeout(step, wait);
        });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => btn.addEventListener(t, stop));
      };
      hold(col.querySelector('.up'), 1);
      hold(col.querySelector('.down'), -1);

      // Wheel: snap to steps of five, wrapping around.
      input.addEventListener('wheel', e => {
        e.preventDefault();
        let v = parseInt(input.value, 10) || 0;
        if (e.deltaY < 0) { v = (Math.floor(v / 5) + 1) * 5; if (v > max) v = 0; }
        else { v = (Math.ceil(v / 5) - 1) * 5; if (v < 0) v = Math.floor(max / 5) * 5; }
        input.value = U.pad2(v);
        refresh();
      }, { passive: false });

      input.addEventListener('keydown', e => {
        if (e.key === 'ArrowUp') { e.preventDefault(); nudge(1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); nudge(-1); }
        else if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
      });
      input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 2);
        refresh();
      });
      input.addEventListener('blur', () => {
        input.value = U.pad2(U.clamp(parseInt(input.value, 10) || 0, 0, max));
        refresh();
      });
      refresh();
      inputs.push(input);
      wrap.appendChild(col);
    });

    el.clock.textContent = '';
    el.clock.appendChild(wrap);
    inputs[1].focus();
    inputs[1].select();

    let done = false;
    function finish(save) {
      if (done) return;
      done = true;
      editingClock = false;
      cancelClockEdit = null;
      if (save) {
        const [h, m, s] = inputs.map((inp, i) => U.clamp(parseInt(inp.value, 10) || 0, 0, maxes[i]));
        const r = A.setClock(h * 3600 + m * 60 + s);
        if (!r.ok && r.message) ui.toast(r.message);
      }
      renderClock(true);
      render();
    }
    // Clicking away saves, once focus has left every field and chevron.
    wrap.addEventListener('focusout', () => {
      setTimeout(() => { if (!wrap.contains(document.activeElement)) finish(true); }, 0);
    });
    cancelClockEdit = () => finish(false);
  }

  /* ── Title editor: double-click the title ──────────────────── */
  let editingTitle = false;
  function enterTitleEdit() {
    if (editingTitle) return;
    const seg = S.activeSegment();
    if (!seg) return;
    editingTitle = true;
    const index = S.state.segmentIndex;
    const original = seg.title;
    const input = document.createElement('input');
    input.className = 'title-input';
    input.type = 'text';
    input.maxLength = 200;
    input.spellcheck = false;
    input.value = original;
    input.setAttribute('aria-label', 'Segment title');
    el.title.textContent = '';
    el.title.appendChild(input);
    input.focus();
    input.select();
    let done = false;
    const finish = save => {
      if (done) return;
      done = true;
      editingTitle = false;
      const v = input.value.trim();
      if (save && v && v !== original) A.editSegment(index, { title: v });
      render();
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
  }

  /* ── Rendering ─────────────────────────────────────────────── */
  function segColor() {
    const list = S.segments();
    const colors = U.segmentColors(list);
    return colors[S.state.segmentIndex] || U.SPECTRUM[0];
  }

  function updateTabTitle() {
    if (E.isCompleted()) document.title = 'Complete! | JoyPro Timer';
    else if (E.isRunning()) document.title = U.formatClock(S.state.remaining) + ' · ' + ((S.activeSegment() || {}).title || '') + ' | JoyPro Timer';
    else document.title = 'JoyPro Timer';
  }

  function render() {
    const list = S.segments();
    const seg = S.activeSegment();
    const running = E.isRunning();
    const completed = E.isCompleted();
    const partWay = !running && !completed && S.state.remaining < S.state.total;

    document.documentElement.style.setProperty('--seg-color', segColor());
    el.app.classList.toggle('is-running', running);

    el.eyebrow.textContent = list.length > 1 ? 'Segment ' + (S.state.segmentIndex + 1) + ' of ' + list.length : 'Single segment';
    el.state.textContent = partWay ? 'Paused' : '';

    if (!editingTitle && seg) el.title.textContent = seg.title;
    el.title.classList.toggle('is-editable', !running);
    el.title.title = running ? '' : 'Double-click to rename';
    el.clock.classList.toggle('is-editable', !running);
    el.clock.classList.toggle('is-paused', partWay && !editingClock);
    el.clock.title = running ? '' : 'Double-click to edit the time';
    renderClock(false);

    el.play.setAttribute('aria-label', running ? 'Pause (Space)' : 'Start (Space)');
    el.play.dataset.tip = running ? 'Pause · Space' : (partWay ? 'Resume · Space' : 'Start · Space');
    el.next.disabled = false;

    el.complete.hidden = !completed;
    el.inner.classList.toggle('is-hidden', completed);
    el.inner.inert = completed;

    const ses = S.activeSession();
    el.chipName.textContent = ses ? ses.name : '';
    el.chip.classList.toggle('is-dirty', A.isDirty());
    el.chip.setAttribute('aria-label', 'Edit session “' + (ses ? ses.name : '') + '”' + (A.isDirty() ? ', unsaved changes' : '') + ' (E)');

    updateTabTitle();
  }
  ui.renderStage = render;

  function showComplete() {
    const ses = S.activeSession();
    const mins = Math.round(S.sessionSeconds(ses) / 60);
    const n = ses.segments.length;
    el.completeTitle.textContent = COMPLETE_MESSAGES[Math.floor(Math.random() * COMPLETE_MESSAGES.length)];
    el.completeStats.textContent = mins + ' minute' + (mins === 1 ? '' : 's') + ' across ' + n + ' segment' + (n === 1 ? '' : 's');
    render();
    setTimeout(() => {
      if (!E.isCompleted()) return;
      // Offer "Start over" to the keyboard, but never steal focus from someone typing.
      const a = document.activeElement;
      const busy = a && a !== document.body && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.closest('#sheet, dialog, .menu'));
      if (!busy) el.restart.focus({ preventScroll: true });
    }, 600);
  }

  /* ── Per-frame: the meter flows smoothly between ticks ─────── */
  let lastP = -1;
  function frame() {
    const p = E.progress();
    if (Math.abs(p - lastP) > 0.0004) {
      el.meter.style.setProperty('--p', p.toFixed(5));
      el.meter.style.setProperty('--head', p > 0.001 && p < 0.999 ? 1 : 0);
      lastP = p;
    }
    if (ui.ribbonFrame) ui.ribbonFrame(p);
    requestAnimationFrame(frame);
  }

  /* ── Wiring ────────────────────────────────────────────────── */
  ui.initStage = () => {
    el.play.addEventListener('click', () => A.toggle());
    el.next.addEventListener('click', () => ui.next());
    el.reset.addEventListener('click', () => ui.reset());
    el.restart.addEventListener('click', () => A.reset());
    el.chip.addEventListener('click', () => ui.openSheet());

    el.clock.addEventListener('mousedown', e => { if (e.detail > 1) e.preventDefault(); });
    el.clock.addEventListener('dblclick', e => { if (!editingClock) { e.preventDefault(); enterClockEdit(); } });
    el.title.addEventListener('mousedown', e => { if (e.detail > 1) e.preventDefault(); });
    el.title.addEventListener('dblclick', e => {
      if (editingTitle || E.isRunning()) return;
      e.preventDefault();
      enterTitleEdit();
    });
    el.clock.addEventListener('mouseenter', () => {
      if (!E.isRunning()) ui.hint('clock-edit', 'Tip: double-click the time to change it');
    });

    // If the timer moves elsewhere mid-edit (a jump, a load), drop the half-made edit.
    S.on('position', d => { if (cancelClockEdit && (!d || d.reason !== 'edit')) cancelClockEdit(); });
    S.on('run', running => { if (running && cancelClockEdit) cancelClockEdit(); });
    ['run', 'tick', 'position', 'segments', 'sessions'].forEach(t => S.on(t, render));
    S.on('complete', showComplete);
    S.on('tick', updateTabTitle);

    buildClock(U.formatClock(S.state.remaining));
    shownText = U.formatClock(S.state.remaining);
    shownSecs = S.state.remaining;
    render();
    requestAnimationFrame(frame);

    const measure = () => ui.measureDigits();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    measure();
  };
})(window.JP = window.JP || {});
