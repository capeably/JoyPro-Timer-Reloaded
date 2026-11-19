/* ═══════════════════════════════════════════════════════════════
   JoyPro Timer Reloaded · actions.js
   Everything a person can do, with the rules that go with it.

   This is the one door into the data. The stage, the ribbon, the
   session editor and the popout all call these functions, so the
   original's three overlapping editing surfaces (traced to two
   bugs in its June 2026 audit) can't drift apart again.

   Each action returns { ok: true, ... } or { ok: false, reason,
   message }. Confirmations ("Skip to the next segment?") belong to
   the UI; the *NeedsConfirm helpers say when one is due.
   ═══════════════════════════════════════════════════════════════ */
(function (JP) {
  'use strict';

  const U = JP.util;
  const S = JP.store;
  const E = JP.engine;

  const ok = extra => Object.assign({ ok: true }, extra || {});
  const fail = (reason, message) => ({ ok: false, reason, message: message || '' });

  /** Persist the active session and tell everyone its segments changed. */
  function changed(detail) {
    S.saveSessions();
    S.emit('segments', detail || {});
    S.emit('sessions', {});
  }

  /**
   * After segments change underneath the clock (a revert), follow the segment
   * that was playing by its id, not its position: a revert can reorder,
   * restore or remove segments. Same length, so the clock carries on;
   * otherwise that segment restarts, paused.
   */
  function syncPosition(prevId) {
    const list = S.segments();
    if (!list.length) return;
    const i = prevId ? list.findIndex(s => s.id === prevId) : -1;
    if (i < 0) {
      E.goTo(Math.min(S.state.segmentIndex, list.length - 1), 'sync');
      return;
    }
    const total = U.segSeconds(list[i]);
    if (total !== S.state.total) {
      E.goTo(i, 'sync');
    } else if (i !== S.state.segmentIndex) {
      S.setPosition(i, S.state.remaining, S.state.total);
      S.emit('position', { index: i, reason: 'reindex' });
    }
  }

  const A = {};

  /* ── Timer ─────────────────────────────────────────────────── */
  A.toggle = () => ok({ running: E.toggle() && E.isRunning() });
  A.play = () => ok({ started: E.start() });
  A.pause = () => ok({ paused: E.pause() });

  A.canNext = () => S.state.segmentIndex < S.segments().length - 1;
  A.nextNeedsConfirm = () => E.isRunning() || S.state.remaining < S.state.total;
  /** Skip to the next segment and start it (as the original did). */
  A.next = () => {
    if (!A.canNext()) return fail('last', 'Already on the last segment');
    E.goTo(S.state.segmentIndex + 1, 'skip');
    E.start();
    return ok();
  };

  A.resetNeedsConfirm = () =>
    E.isRunning() || S.state.segmentIndex > 0 || S.state.remaining < S.state.total || E.isCompleted();
  A.reset = () => {
    E.goTo(0, 'reset');
    return ok();
  };

  A.jumpNeedsConfirm = index => E.isRunning() && index !== S.state.segmentIndex;
  /** Jump to a segment, paused, at full length. */
  A.jump = index => {
    if (index === S.state.segmentIndex && !E.isCompleted()) return ok({ same: true });
    return E.goTo(index, 'jump') ? ok() : fail('none');
  };

  /**
   * The big clock was edited (paused only). On a segment that hasn't started,
   * the edit sets its length; mid-segment it changes only the time left.
   */
  A.setClock = seconds => {
    if (E.isRunning()) return fail('running', 'Pause the timer to edit the time');
    const secs = Math.round(seconds);
    if (!(secs >= S.LIMITS.minSeconds)) return fail('min', 'Minimum duration is 1 second');
    if (secs > S.LIMITS.maxSeconds) return fail('max', 'Maximum duration is 99:59:59');
    const seg = S.activeSegment();
    if (!seg) return fail('none');
    // "Not started yet" is tracked, not inferred from remaining === total:
    // a mid-segment edit can raise the total to equal the time left.
    const fresh = !S.state.started && S.state.remaining === S.state.total && !E.isCompleted();
    if (fresh) {
      seg.durationMinutes = Math.floor(secs / 60);
      seg.durationSeconds = secs % 60;
      E.setRemaining(secs, secs, 'edit');
      changed({ index: S.state.segmentIndex, fields: ['seconds'] });
    } else {
      E.setRemaining(secs, Math.max(S.state.total, secs), 'edit');
    }
    return ok({ fresh });
  };

  /* ── Segments (of the active session) ──────────────────────── */
  /**
   * Edit one segment. patch may hold: title, seconds, soundEnabled, soundKey,
   * autoAdvance, theme. Changing the current segment's length resets its clock,
   * so that's blocked while it runs.
   */
  A.editSegment = (index, patch) => {
    const seg = S.segmentAt(index);
    if (!seg) return fail('none');
    const isCurrent = index === S.state.segmentIndex;
    let title = null;
    let secs = null;

    if ('title' in patch) {
      title = String(patch.title == null ? '' : patch.title).trim().slice(0, 200);
      if (!title) return fail('title', 'A segment needs a title');
    }
    if ('seconds' in patch) {
      secs = Math.round(patch.seconds);
      if (!(secs >= S.LIMITS.minSeconds)) return fail('min', 'Minimum duration is 1 second');
      if (secs > S.LIMITS.maxSeconds) return fail('max', 'Maximum duration is 99:59:59');
      if (secs !== U.segSeconds(seg) && isCurrent && E.isRunning()) {
        return fail('running', 'Pause the timer to change the current segment’s length');
      }
    }

    if (title !== null) seg.title = title;
    let lengthChanged = false;
    if (secs !== null && secs !== U.segSeconds(seg)) {
      seg.durationMinutes = Math.floor(secs / 60);
      seg.durationSeconds = secs % 60;
      lengthChanged = true;
    }
    if ('soundEnabled' in patch) seg.soundEnabled = !!patch.soundEnabled;
    if ('autoAdvance' in patch) seg.autoAdvance = !!patch.autoAdvance;
    if ('soundKey' in patch && /^[\w:-]{1,64}$/.test(String(patch.soundKey))) seg.soundKey = String(patch.soundKey);
    if ('theme' in patch) {
      seg.theme = patch.theme === 'default' || S.THEME_KEYS.has(patch.theme) ? patch.theme : 'default';
    }

    if (lengthChanged && isCurrent) E.setRemaining(secs, secs, 'edit');
    changed({ index, fields: Object.keys(patch) });
    return ok();
  };

  A.addSegment = () => {
    if (E.isRunning()) return fail('running', 'Pause the timer to add segments');
    const seg = S.cleanSegment({
      title: 'New Segment', durationMinutes: 5, durationSeconds: 0,
      soundEnabled: true, soundKey: 'default', autoAdvance: true, theme: 'default'
    });
    S.segments().push(seg);
    changed({ added: seg.id });
    return ok({ segment: seg, index: S.segments().length - 1 });
  };

  A.deleteSegment = index => {
    if (E.isRunning()) return fail('running', 'Pause the timer to delete segments');
    const list = S.segments();
    if (list.length <= 1) return fail('last', 'A session needs at least one segment');
    if (!list[index]) return fail('none');
    list.splice(index, 1);
    const cur = S.state.segmentIndex;
    if (index < cur) {
      S.setPosition(cur - 1, S.state.remaining, S.state.total);
      S.emit('position', { index: cur - 1, reason: 'reindex' });
    } else if (index === cur) {
      E.goTo(Math.min(cur, list.length - 1), 'delete');
    }
    changed({ removed: index });
    return ok();
  };

  A.moveSegment = (from, to) => {
    if (E.isRunning()) return fail('running', 'Pause the timer to reorder segments');
    const list = S.segments();
    if (from === to || !list[from] || to < 0 || to >= list.length) return fail('noop');
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    const cur = S.state.segmentIndex;
    let next = cur;
    if (cur === from) next = to;
    else if (from < cur && to >= cur) next = cur - 1;
    else if (from > cur && to <= cur) next = cur + 1;
    if (next !== cur) {
      S.setPosition(next, S.state.remaining, S.state.total);
      S.emit('position', { index: next, reason: 'reindex' });
    }
    changed({ moved: [from, to] });
    return ok();
  };

  /* ── Sessions ──────────────────────────────────────────────── */
  const MAX_NAME = 100;
  function validName(name, exceptId) {
    const n = String(name == null ? '' : name).trim().slice(0, MAX_NAME).trim();
    if (!n) return fail('empty', 'Please enter a name');
    if (S.nameTaken(n, exceptId)) return fail('taken', 'A session with that name already exists');
    return ok({ name: n });
  }
  A.validateNewName = name => validName(name);

  /** "Name (copy)", "Name (copy 2)", …: unique, and short enough to keep its suffix. */
  A.suggestCopyName = name => {
    const base = String(name || 'Session').trim();
    for (let k = 1; ; k++) {
      const suffix = k === 1 ? ' (copy)' : ' (copy ' + k + ')';
      const candidate = base.slice(0, MAX_NAME - suffix.length).trim() + suffix;
      if (!S.nameTaken(candidate)) return candidate;
    }
  };

  A.renameSession = name => {
    const ses = S.activeSession();
    const v = validName(name, ses.id);
    if (!v.ok) return v;
    if (v.name === ses.name) return ok({ same: true });
    ses.name = v.name;
    changed({ renamed: true });
    return ok();
  };

  A.isDirty = () => S.isDirty(S.activeSession());

  A.save = () => {
    const ses = S.activeSession();
    S.markSaved(ses);
    S.emit('sessions', {});
    return ok({ session: ses });
  };

  /** Save the current edits under a new name; the original goes back to its saved version. */
  A.saveAs = name => {
    const v = validName(name);
    if (!v.ok) return v;
    const ses = S.activeSession();
    const copy = {
      id: U.uid('ses'),
      name: v.name,
      segments: S.clone(ses.segments).map(s => Object.assign(s, { id: U.uid('seg') })),
      saved: null
    };
    copy.saved = S.snapshotOf(copy);
    if (ses.saved) S.revertToSaved(ses);
    else S.removeSession(ses.id);
    S.addSession(copy, true);
    changed({ replaced: true });
    return ok({ session: copy });
  };

  /** Throw away unsaved edits. A session that was never saved is discarded. */
  A.revert = () => {
    const ses = S.activeSession();
    if (!ses.saved) {
      if (S.sessions.length <= 1) return fail('last', 'Nothing to revert to');
      S.removeSession(ses.id);
      A.load(S.sessions[0].id);
      return ok({ discarded: true });
    }
    const playingId = (S.activeSegment() || {}).id;
    S.revertToSaved(ses);
    syncPosition(playingId);
    changed({ reverted: true });
    return ok();
  };

  A.load = id => {
    const ses = S.sessionById(id);
    if (!ses) return fail('none');
    E.pause();
    S.setActiveSession(id);
    E.goTo(0, 'load');
    S.emit('segments', { loaded: id });
    S.emit('sessions', {});
    return ok({ session: ses });
  };

  A.newSession = () => {
    const ses = S.cleanSession({
      name: S.uniqueName('New Session'),
      segments: [{
        title: 'Focus Block', durationMinutes: 25, durationSeconds: 0,
        soundEnabled: true, soundKey: 'default', autoAdvance: true, theme: 'default'
      }]
    });
    ses.saved = null; // unsaved until the first Save
    E.pause();
    S.addSession(ses, true);
    E.goTo(0, 'load');
    S.emit('segments', { loaded: ses.id });
    S.emit('sessions', {});
    return ok({ session: ses });
  };

  A.duplicate = id => {
    const src = S.sessionById(id);
    if (!src) return fail('none');
    const copy = {
      id: U.uid('ses'),
      name: A.suggestCopyName(src.name),
      segments: S.clone(src.segments).map(s => Object.assign(s, { id: U.uid('seg') })),
      saved: null
    };
    copy.saved = S.snapshotOf(copy);
    S.addSession(copy, false);
    S.emit('sessions', {});
    return ok({ session: copy });
  };

  A.deleteSession = id => {
    if (S.sessions.length <= 1) return fail('last', 'You can’t delete the last session');
    if (!S.sessionById(id)) return fail('none');
    const wasActive = id === S.state.activeSessionId;
    S.removeSession(id);
    if (wasActive) A.load(S.sessions[0].id);
    else S.emit('sessions', {});
    return ok({ wasActive });
  };

  /** Import sessions from parsed JSON (the original app's export format works too). */
  A.importSessions = data => {
    if (!Array.isArray(data)) return fail('format', 'Invalid file: expected a list of sessions');
    let added = 0;
    let skipped = 0;
    data.forEach(item => {
      const ses = item && Array.isArray(item.segments) ? S.cleanSession({ name: item.name, segments: item.segments }) : null;
      if (!ses || S.nameTaken(ses.name)) { skipped++; return; }
      ses.id = U.uid('ses'); // never trust ids from a file
      ses.segments.forEach(s => { s.id = U.uid('seg'); });
      ses.saved = S.snapshotOf(ses);
      S.addSession(ses, false);
      added++;
    });
    if (added) S.emit('sessions', {});
    return ok({ added, skipped });
  };

  /** Sessions in the original app's export format. */
  A.exportData = () =>
    S.sessions.map(s => ({
      name: s.name,
      segments: s.segments.map(seg => {
        const out = Object.assign({}, seg);
        delete out.id;
        return out;
      })
    }));

  /* ── Settings ──────────────────────────────────────────────── */
  A.setTheme = key => {
    if (!S.THEME_KEYS.has(key)) return fail('theme');
    S.state.theme = key;
    S.saveState();
    S.emit('settings', { theme: key });
    return ok();
  };

  A.toggleMute = () => {
    S.state.muted = !S.state.muted;
    S.saveState();
    S.emit('settings', { muted: S.state.muted });
    return ok({ muted: S.state.muted });
  };

  A.setRibbonCollapsed = collapsed => {
    S.state.ribbonCollapsed = !!collapsed;
    S.saveState();
    S.emit('settings', { ribbonCollapsed: S.state.ribbonCollapsed });
    return ok();
  };

  JP.actions = A;
})(window.JP = window.JP || {});
