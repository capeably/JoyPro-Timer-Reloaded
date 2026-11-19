/* ═══════════════════════════════════════════════════════════════
   JoyPro Timer Reloaded · library.js
   Two dialogs: Sessions (load, duplicate, edit, delete, import,
   export) and the Sound Library (preview, upload, rename, delete).
   Export files use the original app's format, so files move freely
   between the two.
   ═══════════════════════════════════════════════════════════════ */
(function (JP) {
  'use strict';

  const U = JP.util;
  const S = JP.store;
  const A = JP.actions;
  const ui = (JP.ui = JP.ui || {});

  const ICON = {
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2.2"/><path d="M15.5 8.5V6.7A2.2 2.2 0 0 0 13.3 4.5H6.7A2.2 2.2 0 0 0 4.5 6.7v6.6a2.2 2.2 0 0 0 2.2 2.2h1.8"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.8v14.4L19 12z"/></svg>'
  };

  /* ── Sessions ──────────────────────────────────────────────── */
  const sesDlg = U.$('#sessionsDlg');
  const sesList = U.$('#sesList');

  function strip(ses) {
    const total = S.sessionSeconds(ses) || 1;
    const colors = U.segmentColors(ses.segments);
    let acc = 0;
    const stops = ses.segments.map((s, i) => {
      const a = (acc / total) * 100;
      acc += U.segSeconds(s);
      return colors[i] + ' ' + a.toFixed(1) + '% ' + ((acc / total) * 100).toFixed(1) + '%';
    });
    return 'linear-gradient(180deg,' + stops.join(',') + ')';
  }

  function renderSessions() {
    const activeId = S.state.activeSessionId;
    sesList.innerHTML = S.sessions.map(ses => {
      const n = ses.segments.length;
      const active = ses.id === activeId;
      const dirty = S.isDirty(ses);
      return '<li class="ses-item' + (active ? ' is-active' : '') + '" data-id="' + U.esc(ses.id) + '">' +
        '<span class="ses-strip" style="background:' + strip(ses) + '" aria-hidden="true"></span>' +
        '<button class="ses-load" type="button" data-act="load" aria-label="Load “' + U.esc(ses.name) + '”">' +
          '<span class="ses-info"><span class="ses-name">' + U.esc(ses.name) + (active ? ' <span class="seg-tag">Active</span>' : '') + '</span>' +
          '<span class="ses-meta">' + n + ' segment' + (n === 1 ? '' : 's') + ' · ' + U.esc(U.formatLong(S.sessionSeconds(ses))) +
          (dirty ? ' · <span class="unsaved">' + (ses.saved ? 'unsaved changes' : 'not saved yet') + '</span>' : '') + '</span></span>' +
        '</button>' +
        '<span class="ses-actions">' +
          '<button class="icon-btn" type="button" data-act="copy" aria-label="Duplicate “' + U.esc(ses.name) + '”" data-tip="Duplicate">' + ICON.copy + '</button>' +
          '<button class="icon-btn" type="button" data-act="edit" aria-label="Edit “' + U.esc(ses.name) + '”" data-tip="Edit">' + ICON.edit + '</button>' +
          '<button class="icon-btn" type="button" data-act="delete" aria-label="Delete “' + U.esc(ses.name) + '”" data-tip="Delete">' + ICON.trash + '</button>' +
        '</span></li>';
    }).join('');
  }

  ui.openSessions = () => {
    renderSessions();
    if (!sesDlg.open) sesDlg.showModal();
  };

  function exportSessions() {
    const blob = new Blob([JSON.stringify(A.exportData(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'joypro-sessions.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    ui.toast('Sessions exported', 'success');
  }

  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); }
      catch (e) { ui.toast('That file isn’t valid JSON'); return; }
      const r = A.importSessions(data);
      if (!r.ok) { ui.toast(r.message); return; }
      let msg = 'Imported ' + r.added + ' session' + (r.added === 1 ? '' : 's');
      if (r.skipped) msg += ' (' + r.skipped + ' skipped)';
      ui.toast(msg, r.added ? 'success' : undefined);
      if (sesDlg.open) renderSessions();
    };
    reader.onerror = () => ui.toast('Couldn’t read that file');
    reader.readAsText(file);
  }

  /* ── Sound Library ─────────────────────────────────────────── */
  const sndDlg = U.$('#soundsDlg');
  const builtinList = U.$('#builtinList');
  const customList = U.$('#customList');
  const usage = U.$('#soundUsage');
  const soundInput = U.$('#soundInput');

  function renderSounds() {
    const F = JP.sounds;
    builtinList.innerHTML = F.BUILT_IN.map(b =>
      '<li class="snd-item"><button class="snd-play" type="button" data-play="' + b.key + '" aria-label="Preview ' + U.esc(b.label) + '">' + ICON.play + '</button>' +
      '<span class="snd-name">' + U.esc(b.label) + '</span><span class="snd-meta">Built-in</span></li>'
    ).join('');

    const mine = F.library();
    customList.innerHTML = mine.length
      ? mine.map(s =>
        '<li class="snd-item" data-id="' + U.esc(s.id) + '">' +
          '<button class="snd-play" type="button" data-play="custom:' + U.esc(s.id) + '" aria-label="Preview ' + U.esc(s.name) + '">' + ICON.play + '</button>' +
          '<span class="snd-name"><button class="snd-name-btn" type="button" data-act="rename" title="Click to rename">' + U.esc(s.name) + '</button></span>' +
          '<span class="snd-meta">' + s.format.toUpperCase() + ' · ' + F.formatSize(s.size) + '</span>' +
          '<button class="icon-btn icon-btn-sm" type="button" data-act="delete" aria-label="Delete ' + U.esc(s.name) + '" data-tip="Delete">' + ICON.trash + '</button>' +
        '</li>').join('')
      : '<li class="snd-empty">No sounds of your own yet. Upload an MP3 or WAV to use it as a chime.</li>';

    const b = F.budget();
    usage.textContent = mine.length + ' of ' + b.max + ' sounds · ' + F.formatSize(F.usedBytes()) + ' of ' + F.formatSize(b.total) + ' used';
  }

  ui.openSounds = () => {
    renderSounds();
    if (!sndDlg.open) sndDlg.showModal();
  };

  async function uploadSounds(files) {
    const F = JP.sounds;
    for (const file of Array.from(files || [])) {
      // Checked one at a time: the library's usage grows as each file is added.
      const problem = F.checkFile(file);
      if (problem) {
        ui.toast(problem, 'warning');
        if (/full|room/.test(problem)) break;
        continue;
      }
      let dataUrl;
      try { dataUrl = await F.readFile(file); }
      catch (e) { ui.toast('Couldn’t read ' + file.name); continue; }
      const name = await ui.promptName('Name this sound', file.name.replace(/\.(mp3|wav)$/i, ''), null, 'Add');
      if (!name) continue;
      try {
        await F.add(file, dataUrl, name);
        ui.toast('Added “' + name + '”', 'success');
      } catch (e) {
        ui.toast('Couldn’t save ' + file.name + ' (storage full?)', 'warning');
      }
    }
    if (sndDlg.open) renderSounds();
  }

  function startRename(button, id) {
    const meta = JP.sounds.library().find(s => s.id === id);
    if (!meta) return;
    const input = document.createElement('input');
    input.className = 'field-input snd-rename';
    input.value = meta.name;
    input.maxLength = 80;
    input.setAttribute('aria-label', 'Sound name');
    button.parentElement.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = save => {
      if (done) return;
      done = true;
      if (save && input.value.trim() && input.value.trim() !== meta.name) JP.sounds.rename(id, input.value);
      renderSounds();
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
  }

  /* ── Wiring ────────────────────────────────────────────────── */
  ui.initLibrary = () => {
    sesList.addEventListener('click', async e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const item = b.closest('.ses-item');
      const id = item.dataset.id;
      const ses = S.sessionById(id);
      if (!ses) return;
      const act = b.dataset.act;
      if (act === 'load') {
        if (id === S.state.activeSessionId) { sesDlg.close(); return; }
        sesDlg.close();
        ui.guardUnsaved(() => {
          A.load(id);
          ui.toast('Loaded “' + ses.name + '”');
        });
      } else if (act === 'copy') {
        const r = A.duplicate(id);
        if (r.ok) ui.toast('Duplicated as “' + r.session.name + '”', 'success');
        renderSessions();
      } else if (act === 'edit') {
        sesDlg.close();
        if (id === S.state.activeSessionId) ui.openSheet();
        else ui.guardUnsaved(() => { A.load(id); ui.openSheet(); });
      } else if (act === 'delete') {
        if (S.sessions.length <= 1) { ui.toast('You can’t delete the last session'); return; }
        if (!(await ui.confirm('Delete “' + ses.name + '”?', { ok: 'Delete', danger: true }))) return;
        const r = A.deleteSession(id);
        if (!r.ok) ui.toast(r.message);
        else ui.toast('Deleted “' + ses.name + '”');
        if (sesDlg.open) renderSessions();
      }
    });

    U.$('#exportBtn').addEventListener('click', exportSessions);
    U.$('#importBtn').addEventListener('click', () => U.$('#importInput').click());
    U.$('#importInput').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      if (f) importFile(f);
      e.target.value = '';
    });
    U.$('#sesNewBtn').addEventListener('click', () => {
      sesDlg.close();
      ui.guardUnsaved(() => {
        A.newSession();
        ui.openSheet('#sheetName');
        requestAnimationFrame(() => U.$('#sheetName').select());
      });
    });

    sndDlg.addEventListener('click', e => {
      const play = e.target.closest('[data-play]');
      if (play) { JP.sounds.preview(play.dataset.play); return; }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const item = b.closest('.snd-item');
      const id = item && item.dataset.id;
      if (!id) return;
      if (b.dataset.act === 'rename') startRename(b, id);
      else if (b.dataset.act === 'delete') {
        ui.arm(b, 'Click again to delete', async () => {
          await JP.sounds.remove(id);
          ui.toast('Sound deleted');
          renderSounds();
        });
      }
    });
    U.$('#uploadBtn').addEventListener('click', () => soundInput.click());
    soundInput.addEventListener('change', e => {
      const files = Array.from(e.target.files || []);
      e.target.value = '';
      uploadSounds(files);
    });

    S.on('sessions', () => { if (sesDlg.open) renderSessions(); });
    S.on('sounds', () => { if (sndDlg.open) renderSounds(); });
  };
})(window.JP = window.JP || {});
