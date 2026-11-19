/* ═══════════════════════════════════════════════════════════════
   JoyPro Timer Reloaded · ribbon.js
   The dock: the whole session as a ribbon of the JoyPro spectrum.
   Each segment is as wide as it is long; finished ones fill, the
   current one flows. Click one to jump to it. Below: totals, the
   session's end time while it runs, Edit session, and collapse.
   ═══════════════════════════════════════════════════════════════ */
(function (JP) {
  'use strict';

  const U = JP.util;
  const S = JP.store;
  const E = JP.engine;
  const A = JP.actions;
  const ui = (JP.ui = JP.ui || {});

  const dock = U.$('#dock');
  const ribbon = U.$('#ribbon');
  const left = U.$('#dockLeft');
  const ends = U.$('#dockEnds');
  const editBtn = U.$('#editBtn');
  const collapseBtn = U.$('#collapseBtn');

  let segEls = [];
  let signature = '';

  function build() {
    const list = S.segments();
    const colors = U.segmentColors(list);
    signature = list.map(s => s.id + '|' + s.title + '|' + U.segSeconds(s)).join(';');
    ribbon.innerHTML = list.map((seg, i) => {
      const secs = U.segSeconds(seg);
      const label = 'Segment ' + (i + 1) + ': ' + seg.title + ', ' + U.formatLong(secs);
      return '<button class="rb-seg" type="button" data-i="' + i + '" style="--w:' + Math.max(1, secs) + ';--c:' + colors[i] + '"' +
        ' aria-label="' + U.esc(label) + '">' +
        '<span class="rb-label"><span class="rb-name">' + U.esc(seg.title) + '</span>' +
        '<span class="rb-dur">' + U.formatShort(secs) + '</span></span>' +
        '<span class="rb-bar"><span class="rb-fill"></span></span></button>';
    }).join('');
    segEls = U.$$('.rb-seg', ribbon);
    requestAnimationFrame(tipNarrow);
  }

  /** Segments too narrow for a label get a tooltip instead. */
  function tipNarrow() {
    segEls.forEach((b, i) => {
      const seg = S.segmentAt(i);
      if (!seg) return;
      if (b.offsetWidth < 92) b.dataset.tip = seg.title + ' · ' + U.formatShort(U.segSeconds(seg));
      else delete b.dataset.tip;
    });
  }

  function updateStates() {
    const cur = S.state.segmentIndex;
    const completed = E.isCompleted();
    const p = E.progress();
    segEls.forEach((b, i) => {
      const done = i < cur || (completed && i === cur);
      b.classList.toggle('is-current', i === cur && !completed);
      b.classList.toggle('is-done', done);
      b.style.setProperty('--p', done ? 1 : i === cur ? p.toFixed(5) : 0);
      if (i === cur) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
  }

  function updateMeta() {
    const ses = S.activeSession();
    const total = S.sessionSeconds(ses);
    const n = ses.segments.length;
    const secsLeft = E.sessionRemaining();
    // Whole minutes (rounded up) so the line doesn't flicker every second
    const leftText = secsLeft >= 60 ? U.formatLong(Math.ceil(secsLeft / 60) * 60) : U.formatLong(Math.ceil(secsLeft));
    const started = S.state.segmentIndex > 0 || S.state.remaining < S.state.total || E.isRunning();
    let text = U.formatLong(total) + ' · ' + n + ' segment' + (n === 1 ? '' : 's');
    if (E.isCompleted()) text += ' · complete';
    else if (started) text += ' · ' + leftText + ' left';
    left.textContent = text;

    if (E.isRunning()) {
      const at = new Date(Date.now() + E.sessionRemaining() * 1000);
      let when = '';
      try { when = at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
      catch (e) { when = U.pad2(at.getHours()) + ':' + U.pad2(at.getMinutes()); }
      ends.textContent = 'Ends ' + when;
    } else {
      ends.textContent = '';
    }
  }

  function updateCollapse() {
    const c = S.state.ribbonCollapsed;
    dock.classList.toggle('is-collapsed', c);
    collapseBtn.setAttribute('aria-expanded', String(!c));
    collapseBtn.setAttribute('aria-label', c ? 'Show the segment ribbon' : 'Hide the segment ribbon');
    collapseBtn.dataset.tip = c ? 'Show segments' : 'Hide segments';
    requestAnimationFrame(tipNarrow);
  }

  function render() {
    const list = S.segments();
    const sig = list.map(s => s.id + '|' + s.title + '|' + U.segSeconds(s)).join(';');
    if (sig !== signature || segEls.length !== list.length) build();
    updateStates();
    updateMeta();
  }
  ui.renderRibbon = render;

  /* Called every frame by the stage loop: only the current segment moves. */
  let lastP = -1;
  ui.ribbonFrame = p => {
    if (Math.abs(p - lastP) < 0.0004) return;
    lastP = p;
    const b = segEls[S.state.segmentIndex];
    if (b && !E.isCompleted()) b.style.setProperty('--p', p.toFixed(5));
  };

  ui.initRibbon = () => {
    ribbon.addEventListener('click', e => {
      const b = e.target.closest('.rb-seg');
      if (b) ui.jump(parseInt(b.dataset.i, 10));
    });
    ribbon.addEventListener('mouseenter', () => ui.hint('ribbon', 'Tip: click a segment in the ribbon to jump to it'));
    editBtn.addEventListener('click', () => ui.openSheet());
    collapseBtn.addEventListener('click', () => A.setRibbonCollapsed(!S.state.ribbonCollapsed));

    ['run', 'position', 'segments', 'sessions', 'complete'].forEach(t => S.on(t, render));
    S.on('settings', d => { if (d && 'ribbonCollapsed' in d) updateCollapse(); });
    // The time left and end time drift with the clock; refresh them gently.
    S.on('tick', () => updateMeta());
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => tipNarrow()).observe(ribbon);

    build();
    render();
    updateCollapse();
  };
})(window.JP = window.JP || {});
