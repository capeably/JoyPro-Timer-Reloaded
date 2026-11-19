/* ═══════════════════════════════════════════════════════════════
   JoyPro Timer Reloaded · engine.js
   The timer itself: start, pause, tick, segment end, auto-advance.

   Timing is wall-clock based (Date.now), so the countdown stays true
   in a background tab and catches up the moment the tab returns.
   A tiny worker drives the heartbeat: Chrome throttles a hidden
   tab's setInterval to once a minute after five minutes, which made
   the original's chimes and auto-advance late; worker timers aren't
   throttled that way. When a segment ends late anyway, the next
   auto-advanced segment starts at the true boundary, so the whole
   session stays on schedule.

   Events (on JP.store's bus):
     run        running state changed (true/false)
     tick       whole seconds remaining changed
     position   segment index / time changed by a jump, skip, reset, edit
     segmentEnd a segment reached 0:00  { index, segment }
     complete   the last segment ended
   ═══════════════════════════════════════════════════════════════ */
(function (JP) {
  'use strict';

  const U = JP.util;
  const S = JP.store;

  let running = false;
  let completed = false;
  let startedAt = 0;        // wall-clock ms when the current run began
  let remainingAtStart = 0; // whole seconds left at that moment
  let now = () => Date.now();

  /* ── Heartbeat ─────────────────────────────────────────────── */
  function makeTicker(onBeat) {
    let worker = null;
    let intervalId = null;
    let wantedMs = 0;
    const useInterval = ms => {
      clearInterval(intervalId);
      intervalId = ms > 0 ? setInterval(onBeat, ms) : null;
    };
    try {
      if (typeof Worker !== 'function' || typeof Blob !== 'function' || !URL.createObjectURL) throw new Error('no worker');
      const src = 'var id=null;onmessage=function(e){clearInterval(id);id=null;if(e.data>0)id=setInterval(function(){postMessage(0)},e.data);};';
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      worker.onmessage = onBeat;
      // Some setups refuse workers late (security policy): fall back quietly.
      worker.onerror = () => { worker = null; useInterval(wantedMs); };
    } catch (e) {
      worker = null;
    }
    return {
      start(ms) { wantedMs = ms; if (worker) worker.postMessage(ms); else useInterval(ms); },
      stop() { wantedMs = 0; if (worker) worker.postMessage(0); useInterval(0); }
    };
  }

  const ticker = makeTicker(() => tick());

  /* ── Core ──────────────────────────────────────────────────── */
  function computeRemaining() {
    const elapsed = Math.floor((now() - startedAt) / 1000);
    return Math.max(0, remainingAtStart - elapsed);
  }

  /** Start (or resume). `fromTime` backdates the start, for on-schedule auto-advance. */
  function start(fromTime) {
    if (running) return false;
    const list = S.segments();
    if (!list.length) return false;
    if (S.state.remaining <= 0) {
      // Pressing play on a finished segment: carry on, or start the session over.
      goTo(S.state.segmentIndex >= list.length - 1 ? 0 : S.state.segmentIndex + 1, 'restart');
    }
    running = true;
    completed = false;
    startedAt = fromTime || now();
    remainingAtStart = S.state.remaining;
    S.state.started = true; // this segment has run, so clock edits now change only the time left
    S.saveState();
    ticker.start(250);
    S.emit('run', true);
    tick(); // catch up at once when backdated
    return true;
  }

  function pause() {
    if (!running) return false;
    // Paused in the instant after the segment really ended, before the next
    // heartbeat noticed: finish it properly (chime, advance), but stay paused.
    if (computeRemaining() <= 0) {
      finishSegment(false);
      return true;
    }
    S.state.remaining = computeRemaining();
    running = false;
    ticker.stop();
    S.saveState();
    S.emit('run', false);
    return true;
  }

  function toggle() {
    return running ? pause() : start();
  }

  function tick() {
    if (!running) return;
    const rem = computeRemaining();
    if (rem !== S.state.remaining) {
      S.state.remaining = rem;
      S.saveStateSoon();
      S.emit('tick', rem);
    }
    if (rem <= 0) finishSegment();
  }

  /** A segment reached 0:00. autoStart false: load the next one but stay paused. */
  function finishSegment(autoStart) {
    const index = S.state.segmentIndex;
    const seg = S.segmentAt(index);
    const endedAt = startedAt + remainingAtStart * 1000;
    running = false;
    ticker.stop();
    S.state.remaining = 0;
    S.emit('run', false);
    S.emit('segmentEnd', { index, segment: seg });

    if (index >= S.segments().length - 1) {
      completed = true;
      S.saveState();
      S.emit('complete', { session: S.activeSession() });
      return;
    }
    goTo(index + 1, 'advance');
    // Auto-advance only if the segment that just ended asks for it.
    if (seg && seg.autoAdvance && autoStart !== false) start(endedAt);
  }

  /** Move to a segment, paused, at its full length. */
  function goTo(index, reason) {
    const list = S.segments();
    if (index < 0 || index >= list.length) return false;
    const wasRunning = running;
    if (running) {
      running = false;
      ticker.stop();
    }
    completed = false;
    const total = U.segSeconds(list[index]);
    S.state.started = false;
    S.setPosition(index, total, total);
    if (wasRunning) S.emit('run', false);
    S.emit('position', { index, reason: reason || 'jump' });
    return true;
  }

  /** Set the current segment's time left (and total), paused. Used by clock edits. */
  function setRemaining(remaining, total, reason) {
    if (running) return false;
    completed = false;
    S.setPosition(S.state.segmentIndex, remaining, total);
    S.emit('position', { index: S.state.segmentIndex, reason: reason || 'edit' });
    return true;
  }

  /** Fractional seconds left, for smooth animation. */
  function exactRemaining() {
    if (!running) return S.state.remaining;
    return Math.max(0, remainingAtStart - (now() - startedAt) / 1000);
  }

  /** How far through the current segment, 0..1, continuous while running. */
  function progress() {
    const t = S.state.total;
    return t > 0 ? U.clamp(1 - exactRemaining() / t, 0, 1) : 0;
  }

  /** Seconds left in the whole session, if it ran straight through. */
  function sessionRemaining() {
    let s = exactRemaining();
    S.segments().forEach((seg, i) => { if (i > S.state.segmentIndex) s += U.segSeconds(seg); });
    return s;
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  }

  JP.engine = {
    start, pause, toggle, tick, goTo, setRemaining,
    isRunning: () => running,
    isCompleted: () => completed,
    exactRemaining, progress, sessionRemaining,
    /* Tests swap in a fake clock. */
    _setClock(fn) { now = fn; }
  };
})(window.JP = window.JP || {});
