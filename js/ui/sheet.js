/* ═══════════════════════════════════════════════════════════════
   JoyPro Timer Reloaded · sheet.js
   The session editor: the one place a session's segments are
   edited (the original had three overlapping editors). It edits
   live, keeps the timer usable beside it, and renders rows by key
   so typing never loses focus.

   Reorder by dragging the grip (mouse or touch), or focus the grip
   and press the arrow keys. Lengths accept "25", "25:00", "1:30:00",
   "90m" or "1h 30m"; arrow keys nudge by a minute (Shift: five).
   ═══════════════════════════════════════════════════════════════ */
(function (JP) {
  'use strict';

  const U = JP.util;
  const S = JP.store;
  const E = JP.engine;
  const A = JP.actions;
  const ui = (JP.ui = JP.ui || {});

  const sheet = U.$('#sheet');
  const app = U.$('#app');
  const list = U.$('#segList');
  const nameInput = U.$('#sheetName');
  const meta = U.$('#sheetMeta');
  const note = U.$('#sheetNote');
  const btn = {
    close: U.$('#sheetClose'),
    save: U.$('#sheetSave'),
    saveAs: U.$('#sheetSaveAs'),
    revert: U.$('#sheetRevert'),
    sessions: U.$('#sheetSessions'),
    fresh: U.$('#sheetNew'),
    add: U.$('#addSegBtn')
  };

  let open = false;
  let returnFocus = null;
  const expanded = new Set(); // segment ids whose details are showing

  const ICON = {
    grip: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M8 5.8v12.4a.9.9 0 0 0 1.37.77l9.9-6.2a.9.9 0 0 0 0-1.54l-9.9-6.2A.9.9 0 0 0 8 5.8z"/></svg>',
    library: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>'
  };

  /* ── Option lists shared with the rest of the UI ───────────── */
  /* (No "Manage sounds…" option: Windows fires `change` as you arrow through a
     closed select, so an action hidden in the list would trigger by accident.
     The Sound Library has its own button beside the picker.) */
  ui.soundOptions = () => {
    let html = '<optgroup label="Built-in">' +
      JP.sounds.BUILT_IN.map(b => '<option value="' + b.key + '">' + U.esc(b.label) + '</option>').join('') + '</optgroup>';
    const mine = JP.sounds.library();
    if (mine.length) {
      html += '<optgroup label="My sounds">' +
        mine.map(s => '<option value="custom:' + U.esc(s.id) + '">' + U.esc(s.name) + '</option>').join('') + '</optgroup>';
    }
    return html;
  };
  ui.themeOptions = () =>
    '<option value="default">Default (the theme menu’s choice)</option>' +
    S.THEMES.map(t => '<option value="' + t.key + '">' + U.esc(t.label) + '</option>').join('');

  const soundExists = key =>
    key && (key.indexOf('custom:') === 0 ? JP.sounds.library().some(s => 'custom:' + s.id === key) : JP.sounds.BUILT_IN.some(b => b.key === key));

  /** Two-click arming for destructive buttons that don't merit a dialog. */
  ui.arm = (button, label, onConfirm) => {
    if (button.classList.contains('is-arming')) {
      clearTimeout(button._armTimer);
      button.classList.remove('is-arming');
      if (button._armRestore) button._armRestore();
      onConfirm();
      return;
    }
    const prevLabel = button.getAttribute('aria-label');
    const prevTip = button.dataset.tip;
    const prevText = button.classList.contains('icon-btn') ? null : button.textContent;
    button.classList.add('is-arming');
    if (prevText !== null) button.textContent = label;
    button.setAttribute('aria-label', label);
    if (prevTip !== undefined) button.dataset.tip = label;
    button._armRestore = () => {
      if (prevText !== null) button.textContent = prevText;
      if (prevLabel !== null) button.setAttribute('aria-label', prevLabel);
      if (prevTip !== undefined) button.dataset.tip = prevTip;
    };
    button._armTimer = setTimeout(() => {
      button.classList.remove('is-arming');
      button._armRestore();
    }, 3000);
  };

  /* ── Rows ──────────────────────────────────────────────────── */
  function createRow(seg) {
    const li = document.createElement('li');
    li.className = 'seg-row';
    li.dataset.id = seg.id;
    const d = 'd_' + seg.id;
    li.innerHTML =
      '<button class="seg-handle" type="button">' + ICON.grip + '</button>' +
      '<div class="seg-main"><span class="seg-chip" aria-hidden="true"></span><span class="seg-num" aria-hidden="true"></span>' +
        '<input class="seg-title-input" type="text" maxlength="200" spellcheck="false" autocomplete="off">' +
        '<span class="seg-tag" hidden>Now</span></div>' +
      '<input class="seg-dur-input" type="text" inputmode="text" spellcheck="false" autocomplete="off">' +
      '<button class="seg-more" type="button" aria-expanded="false" aria-controls="' + d + '">' + ICON.chevron + '</button>' +
      '<div class="seg-details" id="' + d + '">' +
        '<label class="switch"><input type="checkbox" data-f="soundEnabled"><span>Chime when it ends</span></label>' +
        '<div class="sound-pick">' +
          '<select class="select" data-f="soundKey" aria-label="Chime sound"></select>' +
          '<button class="icon-btn" type="button" data-act="preview" aria-label="Preview the chime" data-tip="Preview">' + ICON.play + '</button>' +
          '<button class="icon-btn" type="button" data-act="del-sound" aria-label="Delete this custom sound" data-tip="Delete sound" hidden>' + ICON.trash + '</button>' +
          '<button class="icon-btn" type="button" data-act="manage-sounds" aria-label="Manage sounds (the Sound Library)" data-tip="Manage sounds">' + ICON.library + '</button>' +
        '</div>' +
        '<label class="switch"><input type="checkbox" data-f="autoAdvance"><span>Start the next segment automatically</span></label>' +
        '<label class="seg-field"><span>Theme</span><select class="select" data-f="theme" aria-label="Theme for this segment"></select></label>' +
        '<div class="seg-details-foot"><span class="spacer"></span>' +
          '<button class="btn btn-quiet btn-sm btn-danger" type="button" data-act="delete">Delete segment</button></div>' +
      '</div>';
    return li;
  }

  function updateRow(row, seg, i, color, ctx) {
    const isCur = i === ctx.cur && !ctx.completed;
    const isOpen = expanded.has(seg.id);
    row.dataset.i = String(i);
    row.style.setProperty('--c', color);
    row.classList.toggle('is-current', isCur);
    row.classList.toggle('is-done', i < ctx.cur || (ctx.completed && i <= ctx.cur));
    row.classList.toggle('is-open', isOpen);
    row.querySelector('.seg-num').textContent = String(i + 1);
    row.querySelector('.seg-tag').hidden = !isCur;

    const title = row.querySelector('.seg-title-input');
    if (document.activeElement !== title) title.value = seg.title;
    title.setAttribute('aria-label', 'Segment ' + (i + 1) + ' title');

    const dur = row.querySelector('.seg-dur-input');
    if (document.activeElement !== dur) {
      dur.value = U.formatField(U.segSeconds(seg));
      dur.classList.remove('is-bad');
    }
    const locked = i === ctx.cur && ctx.running;
    dur.disabled = locked;
    dur.title = locked ? 'Pause the timer to change the current segment’s length' : 'Length: 25, 25:00, 1:30:00 or 90m';
    dur.setAttribute('aria-label', 'Segment ' + (i + 1) + ' length');

    const handle = row.querySelector('.seg-handle');
    handle.disabled = ctx.running;
    handle.setAttribute('aria-label', 'Reorder “' + seg.title + '”: drag, or use the arrow keys');

    const more = row.querySelector('.seg-more');
    more.setAttribute('aria-expanded', String(isOpen));
    more.setAttribute('aria-label', 'Options for “' + seg.title + '”');

    row.querySelector('[data-f="soundEnabled"]').checked = !!seg.soundEnabled;
    row.querySelector('.sound-pick').classList.toggle('is-off', !seg.soundEnabled);
    const sel = row.querySelector('[data-f="soundKey"]');
    if (sel.dataset.sig !== ctx.soundSig) {
      sel.innerHTML = ctx.soundHTML;
      sel.dataset.sig = ctx.soundSig;
    }
    sel.value = soundExists(seg.soundKey) ? seg.soundKey : 'default';
    row.querySelector('[data-act="del-sound"]').hidden = sel.value.indexOf('custom:') !== 0;
    row.querySelector('[data-f="autoAdvance"]').checked = !!seg.autoAdvance;
    const th = row.querySelector('[data-f="theme"]');
    if (!th.options.length) th.innerHTML = ui.themeOptions();
    th.value = seg.theme || 'default';

    const del = row.querySelector('[data-act="delete"]');
    del.disabled = ctx.running || ctx.count <= 1;
    del.title = ctx.count <= 1 ? 'A session needs at least one segment' : ctx.running ? 'Pause the timer to delete segments' : '';
  }

  function renderRows() {
    const segs = S.segments();
    const colors = U.segmentColors(segs);
    const soundHTML = ui.soundOptions();
    const ctx = {
      cur: S.state.segmentIndex,
      running: E.isRunning(),
      completed: E.isCompleted(),
      count: segs.length,
      soundHTML,
      soundSig: String(U.hash(soundHTML))
    };
    const existing = new Map(U.$$('.seg-row', list).map(r => [r.dataset.id, r]));
    let prev = null;
    segs.forEach((seg, i) => {
      let row = existing.get(seg.id);
      if (row) existing.delete(seg.id);
      else row = createRow(seg);
      updateRow(row, seg, i, colors[i], ctx);
      const want = prev ? prev.nextSibling : list.firstChild;
      if (row !== want) list.insertBefore(row, want);
      prev = row;
    });
    existing.forEach((r, id) => { r.remove(); expanded.delete(id); });
  }

  function renderHead() {
    const ses = S.activeSession();
    const dirty = A.isDirty();
    if (document.activeElement !== nameInput) nameInput.value = ses.name;
    const total = S.sessionSeconds(ses);
    const n = ses.segments.length;
    meta.innerHTML = U.esc(n + ' segment' + (n === 1 ? '' : 's') + ' · ' + U.formatLong(total)) + ' · ' +
      (dirty ? '<span class="unsaved">' + (ses.saved ? 'Unsaved changes' : 'Not saved yet') + '</span>' : 'Saved');
    btn.save.disabled = !dirty;
    btn.revert.textContent = ses.saved ? 'Revert' : 'Discard';
    btn.revert.disabled = !dirty || (!ses.saved && S.sessions.length <= 1);

    // The session's own spectrum, as a hairline across the top of the editor.
    const colors = U.segmentColors(ses.segments);
    let acc = 0;
    const stops = ses.segments.map((s, i) => {
      const a = (acc / total) * 100;
      acc += U.segSeconds(s);
      return colors[i] + ' ' + a.toFixed(2) + '% ' + ((acc / total) * 100).toFixed(2) + '%';
    });
    sheet.style.setProperty('--sheet-spectrum', 'linear-gradient(90deg,' + stops.join(',') + ')');

    btn.add.disabled = E.isRunning();
    if (E.isRunning()) note.textContent = 'Pause the timer to add, delete or reorder segments.';
    else if (note.dataset.kind !== 'move') note.textContent = '';
    note.dataset.kind = '';
  }

  function render() {
    if (!open) return;
    renderHead();
    renderRows();
  }
  ui.renderSheet = render;

  /* ── Lengths ───────────────────────────────────────────────── */
  function flagBad(input, message) {
    input.classList.remove('is-bad');
    void input.offsetWidth; // restart the shake
    input.classList.add('is-bad');
    if (message) ui.toast(message);
  }

  function commitLength(input, i, secsOverride) {
    const seg = S.segmentAt(i);
    if (!seg) return;
    const secs = secsOverride != null ? secsOverride : U.parseDuration(input.value);
    if (!(secs >= 1)) {
      flagBad(input, 'Try a length like 25, 25:00 or 1:30:00');
      input.value = U.formatField(U.segSeconds(seg));
      return;
    }
    const r = A.editSegment(i, { seconds: secs });
    if (!r.ok) {
      flagBad(input, r.message);
      input.value = U.formatField(U.segSeconds(seg));
      return;
    }
    input.value = U.formatField(U.segSeconds(S.segmentAt(i)));
  }

  /* ── Drag to reorder (pointer events: mouse and touch) ─────── */
  function beginDrag(e, row, handle) {
    if (E.isRunning()) { ui.toast('Pause the timer to reorder segments'); return; }
    e.preventDefault();
    const rows = U.$$('.seg-row', list);
    const from = rows.indexOf(row);
    if (from < 0 || rows.length < 2) return;
    const rects = rows.map(r => r.getBoundingClientRect());
    const rowStep = row.getBoundingClientRect().height + 3;
    const startY = e.clientY;
    let to = from;
    row.classList.add('is-dragging');
    try { handle.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }

    const move = ev => {
      const dy = ev.clientY - startY;
      row.style.transform = 'translateY(' + dy + 'px)';
      const mid = rects[from].top + rects[from].height / 2 + dy;
      to = from;
      rects.forEach((r, i) => {
        const c = r.top + r.height / 2;
        if (i < from && mid < c) to = Math.min(to, i);
        if (i > from && mid > c) to = Math.max(to, i);
      });
      rows.forEach((r, i) => {
        if (r === row) return;
        let shift = 0;
        if (from < to && i > from && i <= to) shift = -rowStep;
        if (from > to && i < from && i >= to) shift = rowStep;
        r.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
      });
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      // Land without the rows sliding back from their drag offsets.
      list.classList.add('no-anim');
      rows.forEach(r => { r.style.transition = 'none'; r.style.transform = ''; });
      row.classList.remove('is-dragging');
      if (to !== from) {
        const r = A.moveSegment(from, to);
        if (!r.ok && r.message) ui.toast(r.message);
      }
      requestAnimationFrame(() => {
        rows.forEach(r => { r.style.transition = ''; });
        list.classList.remove('no-anim');
      });
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  /* ── Open / close ──────────────────────────────────────────── */
  ui.isSheetOpen = () => open;

  ui.openSheet = focusTarget => {
    if (!open) {
      open = true;
      returnFocus = document.activeElement;
      sheet.inert = false;
      sheet.classList.add('is-open');
      app.classList.add('sheet-open');
      render();
    }
    requestAnimationFrame(() => {
      const target = typeof focusTarget === 'string' ? U.$(focusTarget, sheet) : focusTarget;
      (target || nameInput).focus({ preventScroll: true });
    });
  };

  ui.closeSheet = () => {
    if (!open) return;
    // Blurring commits a half-typed field (its change event fires).
    const a = document.activeElement;
    if (a && sheet.contains(a) && a.blur) a.blur();
    open = false;
    sheet.classList.remove('is-open');
    app.classList.remove('sheet-open');
    sheet.inert = true;
    if (returnFocus && document.contains(returnFocus) && returnFocus.focus && returnFocus !== document.body) {
      returnFocus.focus({ preventScroll: true });
    }
  };

  /* ── Wiring ────────────────────────────────────────────────── */
  ui.initSheet = () => {
    btn.close.addEventListener('click', ui.closeSheet);

    btn.save.addEventListener('click', () => {
      A.save();
      ui.toast('Saved “' + S.activeSession().name + '”', 'success');
    });
    btn.saveAs.addEventListener('click', async () => {
      const ses = S.activeSession();
      const name = await ui.promptName('Save session as', A.suggestCopyName(ses.name), ui.nameTakenMessage);
      if (!name) return;
      const r = A.saveAs(name);
      ui.toast(r.ok ? 'Saved as “' + name + '”' : r.message, r.ok ? 'success' : undefined);
    });
    btn.revert.addEventListener('click', async () => {
      const ses = S.activeSession();
      const question = ses.saved ? 'Revert “' + ses.name + '” to its last save?' : 'Discard the new session “' + ses.name + '”?';
      if (!(await ui.confirm(question, { ok: ses.saved ? 'Revert' : 'Discard', danger: true }))) return;
      const r = A.revert();
      if (!r.ok && r.message) ui.toast(r.message);
    });
    btn.sessions.addEventListener('click', () => ui.openSessions());
    btn.fresh.addEventListener('click', () => {
      ui.guardUnsaved(() => {
        A.newSession();
        requestAnimationFrame(() => { nameInput.focus(); nameInput.select(); });
      });
    });
    btn.add.addEventListener('click', () => {
      const r = A.addSegment();
      if (!r.ok) { ui.toast(r.message); return; }
      requestAnimationFrame(() => {
        const input = list.querySelector('.seg-row[data-id="' + r.segment.id + '"] .seg-title-input');
        if (!input) return;
        input.scrollIntoView({ block: 'nearest', behavior: U.reducedMotion() ? 'auto' : 'smooth' });
        input.focus();
        input.select();
      });
    });

    nameInput.addEventListener('change', () => {
      const r = A.renameSession(nameInput.value);
      if (!r.ok) {
        ui.toast(r.message);
        nameInput.value = S.activeSession().name;
      }
    });
    nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); nameInput.blur(); }
      else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        nameInput.value = S.activeSession().name;
        nameInput.blur();
      }
    });

    // Remember each field's value on entry, for Esc.
    list.addEventListener('focusin', e => {
      const t = e.target;
      const row = t.closest && t.closest('.seg-row');
      if (!row || !t.matches('.seg-title-input, .seg-dur-input')) return;
      const seg = S.segmentAt(parseInt(row.dataset.i, 10));
      if (seg) t.dataset.orig = t.matches('.seg-title-input') ? seg.title : String(U.segSeconds(seg));
    });

    list.addEventListener('input', e => {
      const t = e.target;
      const row = t.closest('.seg-row');
      if (!row || !t.matches('.seg-title-input')) return;
      const v = t.value.trim();
      if (v) A.editSegment(parseInt(row.dataset.i, 10), { title: v });
    });

    list.addEventListener('change', e => {
      const t = e.target;
      const row = t.closest('.seg-row');
      if (!row) return;
      const i = parseInt(row.dataset.i, 10);
      const seg = S.segmentAt(i);
      if (!seg) return;
      if (t.matches('.seg-title-input')) {
        if (!t.value.trim()) t.value = seg.title;
        return;
      }
      if (t.matches('.seg-dur-input')) { commitLength(t, i); return; }
      const f = t.dataset.f;
      if (f === 'soundEnabled' || f === 'autoAdvance') {
        A.editSegment(i, { [f]: t.checked });
      } else if (f === 'soundKey') {
        A.editSegment(i, { soundKey: t.value });
      } else if (f === 'theme') {
        A.editSegment(i, { theme: t.value });
      }
    });

    list.addEventListener('keydown', e => {
      const t = e.target;
      const row = t.closest('.seg-row');
      if (!row) return;
      const i = parseInt(row.dataset.i, 10);
      const seg = S.segmentAt(i);
      if (!seg) return;

      if (t.matches('.seg-title-input, .seg-dur-input')) {
        if (e.key === 'Enter') {
          e.preventDefault();
          t.blur();
        } else if (e.key === 'Escape') {
          // Titles save as you type and arrows nudge lengths at once, so Esc
          // puts back what the field held when you entered it.
          e.preventDefault();
          e.stopPropagation();
          if (t.matches('.seg-title-input')) {
            const orig = t.dataset.orig != null ? t.dataset.orig : seg.title;
            t.value = orig;
            if (orig && seg.title !== orig) A.editSegment(i, { title: orig });
          } else {
            const orig = parseInt(t.dataset.orig, 10);
            if (orig >= 1 && orig !== U.segSeconds(seg)) commitLength(t, i, orig);
            else t.value = U.formatField(U.segSeconds(seg));
          }
          t.blur();
        } else if (t.matches('.seg-dur-input') && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          const stepSecs = e.shiftKey ? 300 : 60;
          const now = U.parseDuration(t.value) || U.segSeconds(seg);
          const next = now + (e.key === 'ArrowUp' ? stepSecs : -stepSecs);
          if (next >= 1) commitLength(t, i, next);
        }
        return;
      }

      if (t.matches('.seg-handle') && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const to = i + (e.key === 'ArrowUp' ? -1 : 1);
        if (to < 0 || to >= S.segments().length) return;
        const id = row.dataset.id;
        const r = A.moveSegment(i, to);
        if (!r.ok) { if (r.message) ui.toast(r.message); return; }
        note.dataset.kind = 'move';
        note.textContent = 'Moved “' + S.segmentAt(to).title + '” to position ' + (to + 1) + '.';
        requestAnimationFrame(() => {
          const h = list.querySelector('.seg-row[data-id="' + id + '"] .seg-handle');
          if (h) h.focus();
        });
      }
    });

    list.addEventListener('click', async e => {
      const b = e.target.closest('button');
      if (!b) return;
      const row = b.closest('.seg-row');
      if (!row) return;
      const i = parseInt(row.dataset.i, 10);
      const seg = S.segmentAt(i);
      if (!seg) return;

      if (b.matches('.seg-more')) {
        if (expanded.has(seg.id)) expanded.delete(seg.id);
        else expanded.add(seg.id);
        row.classList.toggle('is-open', expanded.has(seg.id));
        b.setAttribute('aria-expanded', String(expanded.has(seg.id)));
      } else if (b.dataset.act === 'preview') {
        JP.sounds.preview(row.querySelector('[data-f="soundKey"]').value);
      } else if (b.dataset.act === 'manage-sounds') {
        ui.openSounds();
      } else if (b.dataset.act === 'del-sound') {
        const key = row.querySelector('[data-f="soundKey"]').value;
        if (key.indexOf('custom:') !== 0) return;
        ui.arm(b, 'Click again to delete this sound', async () => {
          await JP.sounds.remove(key.slice(7));
          ui.toast('Sound deleted');
        });
      } else if (b.dataset.act === 'delete') {
        if (!(await ui.confirm('Delete “' + seg.title + '”?', { ok: 'Delete', danger: true }))) return;
        const r = A.deleteSegment(parseInt(row.dataset.i, 10));
        if (!r.ok && r.message) ui.toast(r.message);
      }
    });

    list.addEventListener('pointerdown', e => {
      const handle = e.target.closest('.seg-handle');
      if (!handle || e.button !== 0 || handle.disabled) return;
      beginDrag(e, handle.closest('.seg-row'), handle);
    });

    ['segments', 'sessions', 'position', 'run', 'sounds', 'complete'].forEach(t => S.on(t, render));
  };
})(window.JP = window.JP || {});
