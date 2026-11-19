/* ═══════════════════════════════════════════════════════════════
   JoyPro Timer Reloaded · store.js
   The single source of truth: sessions, the timer position and
   settings, plus persistence, migration and an event bus.

   Nothing here knows about the DOM, and nothing here enforces user
   rules (like "pause before deleting"); that lives in actions.js.
   UI code never mutates this data directly: it calls JP.actions.

   Data model
     session  { id, name, segments: [segment], saved: {name, segments} | null }
     segment  { id, title, durationMinutes, durationSeconds, soundEnabled,
                soundKey, autoAdvance, theme }
   Segment fields keep the original app's names, so exported files
   stay interchangeable with it.
   ═══════════════════════════════════════════════════════════════ */
(function (JP) {
  'use strict';

  const U = JP.util;

  const KEY = {
    state: 'joypro2.state',
    sessions: 'joypro2.sessions',
    onboarded: 'joypro2.onboarded',
    hints: 'joypro2.hints',
    migrated: 'joypro2.migrated'
  };

  /* The original app's keys: read once on first run, never written. */
  const LEGACY = { state: 'joypro_state', sessions: 'joypro_sessions', sequences: 'joypro_sequences' };

  const THEMES = [
    { key: 'light', label: 'Light', mode: 'light' },
    { key: 'dark', label: 'Dark', mode: 'dark' },
    { key: 'starryNight', label: 'Starry Night', mode: 'dark' },
    { key: 'growingTree', label: 'Growing Tree', mode: 'light' }
  ];
  const THEME_KEYS = new Set(THEMES.map(t => t.key));
  const DEFAULT_THEME = 'growingTree';

  const MAX_MINUTES = 5999; // 99:59:59 at most
  const LIMITS = { maxSeconds: MAX_MINUTES * 60 + 59, minSeconds: 1 };

  function makeSeg(title, minutes, autoAdvance) {
    return {
      title,
      durationMinutes: minutes,
      durationSeconds: 0,
      soundEnabled: true,
      soundKey: 'default',
      autoAdvance,
      theme: 'default'
    };
  }

  const DEFAULT_SESSIONS = [
    {
      name: 'Focus Session (60 min)',
      segments: [
        makeSeg('Set Intentions', 3, true), makeSeg('Focus Block', 25, true), makeSeg('Break', 5, true),
        makeSeg('Focus Block', 25, true), makeSeg('Wrap Up', 2, false)
      ]
    },
    {
      name: 'Focus Session (90 min)',
      segments: [
        makeSeg('Set Intentions', 3, true), makeSeg('Focus Block', 25, true), makeSeg('Break', 5, true),
        makeSeg('Focus Block', 25, true), makeSeg('Break', 5, true), makeSeg('Focus Block', 25, true),
        makeSeg('Wrap Up', 2, false)
      ]
    },
    {
      name: 'Deep Focus (120 min)',
      segments: [
        makeSeg('Set Intentions', 3, true), makeSeg('Focus Block', 25, true), makeSeg('Break', 5, true),
        makeSeg('Focus Block', 25, true), makeSeg('Break', 5, true), makeSeg('Focus Block', 25, true),
        makeSeg('Break', 5, true), makeSeg('Focus Block', 25, true), makeSeg('Wrap Up', 2, false)
      ]
    }
  ];

  /* ── Event bus ─────────────────────────────────────────────── */
  const handlers = {};
  function on(type, fn) {
    (handlers[type] = handlers[type] || []).push(fn);
    return () => { handlers[type] = (handlers[type] || []).filter(f => f !== fn); };
  }
  function emit(type, detail) {
    (handlers[type] || []).slice().forEach(fn => {
      try { fn(detail); } catch (e) { console.error('[JoyPro] ' + type + ' handler failed', e); }
    });
  }

  /* ── Storage (guarded: private windows and full disks throw) ── */
  const storage = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  function readJSON(k) {
    const raw = storage.get(k);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  /* ── Sanitizing (imports, migration, and anything read back) ─ */
  function cleanSegment(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const mins = U.clamp(parseInt(raw.durationMinutes, 10) || 0, 0, MAX_MINUTES);
    const secs = U.clamp(parseInt(raw.durationSeconds, 10) || 0, 0, 59);
    if (mins * 60 + secs < LIMITS.minSeconds) return null;
    return {
      id: typeof raw.id === 'string' && /^seg_[0-9a-z]{4,24}$/i.test(raw.id) ? raw.id : U.uid('seg'),
      title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 200) : 'Segment',
      durationMinutes: mins,
      durationSeconds: secs,
      soundEnabled: !!raw.soundEnabled,
      soundKey: typeof raw.soundKey === 'string' && /^[\w:-]{1,64}$/.test(raw.soundKey) ? raw.soundKey : 'default',
      autoAdvance: !!raw.autoAdvance,
      theme: typeof raw.theme === 'string' && (raw.theme === 'default' || THEME_KEYS.has(raw.theme)) ? raw.theme : 'default'
    };
  }

  function cleanSegments(list) {
    return Array.isArray(list) ? list.map(cleanSegment).filter(Boolean) : [];
  }

  function cleanSession(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 100) : '';
    // The original app once called segments "sessions"; accept either.
    const segments = cleanSegments(raw.segments || raw.sessions);
    if (!name || !segments.length) return null;
    let saved = null;
    if (raw.saved && typeof raw.saved === 'object') {
      const savedSegs = cleanSegments(raw.saved.segments);
      const savedName = typeof raw.saved.name === 'string' ? raw.saved.name.trim().slice(0, 100) : '';
      if (savedName && savedSegs.length) saved = { name: savedName, segments: savedSegs };
    }
    return {
      id: typeof raw.id === 'string' && /^ses_[0-9a-z]{4,24}$/i.test(raw.id) ? raw.id : U.uid('ses'),
      name,
      segments,
      saved
    };
  }

  const clone = o => JSON.parse(JSON.stringify(o));
  const snapshotOf = s => ({ name: s.name, segments: clone(s.segments) });

  /* ── The model ─────────────────────────────────────────────── */
  const state = {
    activeSessionId: null,
    segmentIndex: 0,
    remaining: 0,     // whole seconds left in the current segment
    total: 0,         // the current segment's length when it was loaded
    started: false,   // has the current segment run at all? (decides what a clock edit means)
    theme: DEFAULT_THEME,
    muted: false,
    ribbonCollapsed: false
  };
  let sessions = [];

  /* ── Persistence ───────────────────────────────────────────── */
  let stateTimer = null;
  function saveState() {
    clearTimeout(stateTimer);
    stateTimer = null;
    storage.set(KEY.state, JSON.stringify(state));
  }
  /** Debounced save for high-frequency changes (the ticking clock). */
  function saveStateSoon() {
    if (stateTimer) return;
    stateTimer = setTimeout(saveState, 400);
  }
  function saveSessions() {
    storage.set(KEY.sessions, JSON.stringify(sessions));
  }

  function freshSessions() {
    return DEFAULT_SESSIONS.map(s => {
      const ses = cleanSession(s);
      ses.saved = snapshotOf(ses);
      return ses;
    });
  }

  /** Bring in the original app's sessions and settings, once. Never writes its keys. */
  function migrateLegacy() {
    const raw = readJSON(LEGACY.sessions) || readJSON(LEGACY.sequences);
    if (!Array.isArray(raw)) return false;
    const imported = raw.map(cleanSession).filter(Boolean);
    if (!imported.length) return false;
    // Legacy sessions were saved as-is; treat them as clean.
    imported.forEach(s => { s.saved = snapshotOf(s); });
    // Drop duplicate names (the original keyed sessions by name).
    const seen = new Set();
    sessions = imported.filter(s => (seen.has(s.name) ? false : (seen.add(s.name), true)));

    const old = readJSON(LEGACY.state) || {};
    const oldName = old.currentSessionName || old.currentSequenceName;
    const active = sessions.find(s => s.name === oldName) || sessions[0];
    state.activeSessionId = active.id;
    const idx = parseInt(old.currentSegmentIndex != null ? old.currentSegmentIndex : old.currentSessionIndex, 10);
    state.segmentIndex = idx >= 0 && idx < active.segments.length ? idx : 0;
    if (typeof old.theme === 'string' && THEME_KEYS.has(old.theme)) state.theme = old.theme;
    state.muted = !!old.globalMute;
    state.ribbonCollapsed = !!old.panelCollapsed;
    const total = U.segSeconds(active.segments[state.segmentIndex]);
    const left = parseInt(old.timerSeconds, 10);
    state.total = total;
    state.remaining = parseInt(old.timerTotal, 10) === total && left >= 0 && left <= total ? left : total;
    state.started = state.remaining < state.total;
    return true;
  }

  function load() {
    const savedSessions = readJSON(KEY.sessions);
    if (Array.isArray(savedSessions)) {
      sessions = savedSessions.map(cleanSession).filter(Boolean);
    }
    const migratedBefore = storage.get(KEY.migrated) === '1';
    let migrated = false;
    if (!sessions.length && !migratedBefore) migrated = migrateLegacy();
    storage.set(KEY.migrated, '1');
    if (!sessions.length) sessions = freshSessions();

    if (!migrated) {
      const st = readJSON(KEY.state);
      if (st && typeof st === 'object') {
        if (typeof st.activeSessionId === 'string') state.activeSessionId = st.activeSessionId;
        state.segmentIndex = parseInt(st.segmentIndex, 10) || 0;
        state.remaining = parseInt(st.remaining, 10);
        state.total = parseInt(st.total, 10);
        state.started = 'started' in st ? !!st.started : state.remaining < state.total;
        if (typeof st.theme === 'string' && THEME_KEYS.has(st.theme)) state.theme = st.theme;
        state.muted = !!st.muted;
        state.ribbonCollapsed = !!st.ribbonCollapsed;
      }
    }

    // Repair the position so it always points at something real.
    if (!sessions.some(s => s.id === state.activeSessionId)) {
      state.activeSessionId = sessions[0].id;
      state.segmentIndex = 0;
      state.total = NaN;
    }
    const ses = activeSession();
    if (state.segmentIndex < 0 || state.segmentIndex >= ses.segments.length) {
      state.segmentIndex = 0;
      state.total = NaN;
    }
    const segTotal = U.segSeconds(ses.segments[state.segmentIndex]);
    if (!(state.total >= 1) || !(state.remaining >= 0) || state.remaining > state.total) {
      state.total = segTotal;
      state.remaining = segTotal;
      state.started = false;
    }
    saveSessions();
    saveState();
    return { migrated };
  }

  /* ── Queries ───────────────────────────────────────────────── */
  function sessionById(id) { return sessions.find(s => s.id === id) || null; }
  function activeSession() { return sessionById(state.activeSessionId) || sessions[0]; }
  function segments() { const s = activeSession(); return s ? s.segments : []; }
  function segmentAt(i) { return segments()[i] || null; }
  function activeSegment() { return segmentAt(state.segmentIndex); }
  function sessionSeconds(ses) { return (ses || activeSession()).segments.reduce((a, s) => a + U.segSeconds(s), 0); }
  function isDirty(ses) {
    const s = ses || activeSession();
    if (!s) return false;
    if (!s.saved) return true;
    return JSON.stringify(snapshotOf(s)) !== JSON.stringify(s.saved);
  }
  function nameTaken(name, exceptId) {
    const n = name.trim().toLowerCase();
    return sessions.some(s => s.id !== exceptId && s.name.trim().toLowerCase() === n);
  }
  function uniqueName(base) {
    if (!nameTaken(base)) return base;
    for (let i = 2; ; i++) {
      const candidate = base + ' ' + i;
      if (!nameTaken(candidate)) return candidate;
    }
  }
  /** The theme in effect for a segment: its own override, or the global theme. */
  function effectiveTheme(seg) {
    const s = seg === undefined ? activeSegment() : seg;
    return s && s.theme && s.theme !== 'default' && THEME_KEYS.has(s.theme) ? s.theme : state.theme;
  }

  /* ── Low-level mutators (rules live in actions.js) ─────────── */
  function setPosition(index, remaining, total) {
    state.segmentIndex = index;
    state.total = total;
    state.remaining = remaining;
    saveState();
  }

  function addSession(ses, makeActive) {
    sessions.push(ses);
    if (makeActive) state.activeSessionId = ses.id;
    saveSessions();
    saveState();
  }

  function removeSession(id) {
    sessions = sessions.filter(s => s.id !== id);
    saveSessions();
  }

  function setActiveSession(id) {
    state.activeSessionId = id;
    saveState();
  }

  function markSaved(ses) {
    ses.saved = snapshotOf(ses);
    saveSessions();
  }

  function revertToSaved(ses) {
    if (!ses.saved) return false;
    ses.name = ses.saved.name;
    ses.segments = clone(ses.saved.segments);
    saveSessions();
    return true;
  }

  /** Point every segment (working and saved copies) using oldKey at newKey. */
  function replaceSoundKey(oldKey, newKey) {
    let changed = false;
    sessions.forEach(ses => {
      [ses.segments, ses.saved && ses.saved.segments].forEach(list => {
        (list || []).forEach(seg => {
          if (seg.soundKey === oldKey) { seg.soundKey = newKey; changed = true; }
        });
      });
    });
    if (changed) saveSessions();
    return changed;
  }

  /* ── Small flags (onboarding, one-time hints) ──────────────── */
  const flags = {
    onboarded: () => storage.get(KEY.onboarded) === '1',
    setOnboarded: () => storage.set(KEY.onboarded, '1'),
    hintShown: id => !!(readJSON(KEY.hints) || {})[id],
    setHintShown: id => {
      const h = readJSON(KEY.hints) || {};
      h[id] = true;
      storage.set(KEY.hints, JSON.stringify(h));
    }
  };

  JP.store = {
    KEY, THEMES, THEME_KEYS, DEFAULT_THEME, LIMITS,
    state,
    get sessions() { return sessions; },
    on, emit,
    storage, readJSON, flags,
    load, saveState, saveStateSoon, saveSessions,
    cleanSegment, cleanSession, snapshotOf, clone,
    sessionById, activeSession, segments, segmentAt, activeSegment,
    sessionSeconds, isDirty, nameTaken, uniqueName, effectiveTheme,
    setPosition, addSession, removeSession, setActiveSession, markSaved, revertToSaved,
    replaceSoundKey
  };
})(window.JP = window.JP || {});
