/* ═══════════════════════════════════════════════════════════════
   Core tests: util, store, engine and actions, run in Node with a
   fake clock and a fake localStorage. No browser, no windows.

     node tests/core.test.js
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const CORE = ['js/core/util.js', 'js/core/store.js', 'js/core/engine.js', 'js/core/actions.js'];

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) { passed++; return; }
  failed++;
  failures.push(name + (detail !== undefined ? '  →  ' + JSON.stringify(detail) : ''));
}

/** A fresh app world: fake storage + fake clock, core scripts loaded. */
function world(seedStorage) {
  const data = new Map(Object.entries(seedStorage || {}));
  const localStorage = {
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: k => data.delete(k)
  };
  const ctx = {
    console,
    localStorage,
    crypto: require('crypto').webcrypto,
    setTimeout: fn => { fn(); return 1; }, // persistence happens at once
    clearTimeout: () => {},
    setInterval: () => 1,                  // ticks are driven by hand below
    clearInterval: () => {},
    Math, Date, JSON, Object, Array, String, Number, Set, Map, Promise, Error, URL
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  CORE.forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
  const JP = ctx.JP;
  let t = 1_700_000_000_000;
  JP.engine._setClock(() => t);
  const advance = secs => { t += secs * 1000; JP.engine.tick(); };
  const moveClock = secs => { t += secs * 1000; }; // time passes, no heartbeat yet
  const events = [];
  ['run', 'tick', 'position', 'segmentEnd', 'complete', 'segments', 'sessions', 'settings'].forEach(type =>
    JP.store.on(type, d => events.push({ type, d })));
  return { JP, S: JP.store, E: JP.engine, A: JP.actions, U: JP.util, advance, moveClock, events, data };
}

/* ── util ──────────────────────────────────────────────────── */
{
  const { U } = world();
  check('parse "25" = 25 min', U.parseDuration('25') === 1500);
  check('parse "25:00"', U.parseDuration('25:00') === 1500);
  check('parse "1:30:00"', U.parseDuration('1:30:00') === 5400);
  check('parse "0:45"', U.parseDuration('0:45') === 45);
  check('parse "90m"', U.parseDuration('90m') === 5400);
  check('parse "1h 30m"', U.parseDuration('1h 30m') === 5400);
  check('parse "1h30"', U.parseDuration('1h30') === 5400);
  check('parse "45s"', U.parseDuration('45s') === 45);
  check('parse "2m30s"', U.parseDuration('2m30s') === 150);
  check('parse junk is NaN', Number.isNaN(U.parseDuration('soon')));
  check('clock MM:SS', U.formatClock(1457) === '24:17');
  check('clock HH:MM:SS', U.formatClock(3725) === '01:02:05');
  check('field form', U.formatField(5400) === '1:30:00' && U.formatField(45) === '0:45');
  check('short form', U.formatShort(5400) === '1h 30m' && U.formatShort(150) === '2m 30s');
  check('spectrum start is lemon', U.toHex(U.spectrum(0)).toLowerCase() === '#e9da3b', U.toHex(U.spectrum(0)));
  check('oklab round trip', U.toHex(U.fromLab(U.toLab([212, 77, 141]))).toLowerCase() === '#d44d8d');
  const r1 = U.rng(42), r2 = U.rng(42);
  check('seeded rng repeats', r1() === r2() && r1() === r2());
}

/* ── fresh load ────────────────────────────────────────────── */
{
  const { S, A } = world();
  const res = S.load();
  check('fresh: not migrated', res.migrated === false);
  check('fresh: three default sessions', S.sessions.length === 3, S.sessions.map(s => s.name));
  check('fresh: first is active', S.activeSession().name === 'Focus Session (60 min)');
  check('fresh: position 0 at 3:00', S.state.segmentIndex === 0 && S.state.remaining === 180 && S.state.total === 180);
  check('fresh: clean', A.isDirty() === false);
  check('fresh: default theme is Growing Tree', S.state.theme === 'growingTree');
  check('60-min session totals 60 min', S.sessionSeconds() === 3600);
}

/* ── running, auto-advance, overshoot catch-up ────────────── */
{
  const { S, E, A, advance, events } = world();
  S.load();
  A.play();
  check('play runs', E.isRunning());
  advance(60);
  check('60 s later: 2:00 left', S.state.remaining === 120, S.state.remaining);
  A.pause();
  check('pause stops', !E.isRunning() && S.state.remaining === 120);
  advance(30);
  check('paused clock holds', S.state.remaining === 120);
  A.play();
  advance(125); // ends 5 s ago
  check('segment end fired', events.some(e => e.type === 'segmentEnd' && e.d.index === 0));
  check('auto-advanced to segment 2', S.state.segmentIndex === 1 && E.isRunning());
  check('next segment started on schedule (5 s in)', S.state.remaining === 1495, S.state.remaining);
  check('progress is fractional and sane', E.progress() > 0 && E.progress() < 0.01, E.progress());
}

/* ── a segment without auto-advance waits ──────────────────── */
{
  const { S, E, A, advance } = world();
  S.load();
  A.editSegment(0, { autoAdvance: false });
  A.play();
  advance(181);
  check('no auto-advance: moved to segment 2, paused', S.state.segmentIndex === 1 && !E.isRunning());
  check('no auto-advance: full length', S.state.remaining === 1500 && S.state.total === 1500);
}

/* ── completion and restart ────────────────────────────────── */
{
  const { S, E, A, advance, events } = world();
  S.load();
  A.jump(4);
  check('jump to Wrap Up', S.state.segmentIndex === 4 && S.state.remaining === 120);
  A.play();
  advance(121);
  check('complete fired', events.some(e => e.type === 'complete'));
  check('completed state', E.isCompleted() && !E.isRunning() && S.state.remaining === 0);
  check('reset needs confirm after completion', A.resetNeedsConfirm());
  A.play();
  check('play after completion starts over', S.state.segmentIndex === 0 && E.isRunning() && !E.isCompleted());
}

/* ── skip and reset ────────────────────────────────────────── */
{
  const { S, E, A, advance } = world();
  S.load();
  check('fresh: next needs no confirm', A.nextNeedsConfirm() === false);
  A.play();
  advance(10);
  check('running: next needs confirm', A.nextNeedsConfirm() === true);
  A.next();
  check('next goes on and starts', S.state.segmentIndex === 1 && E.isRunning() && S.state.remaining === 1500);
  A.jump(4);
  check('jump pauses', !E.isRunning());
  const r = A.next();
  check('next on last fails', !r.ok && r.reason === 'last');
  A.reset();
  check('reset to segment 1, paused, full', S.state.segmentIndex === 0 && !E.isRunning() && S.state.remaining === 180);
}

/* ── editing the big clock ─────────────────────────────────── */
{
  const { S, A, advance } = world();
  S.load();
  const r1 = A.setClock(600);
  check('fresh clock edit sets duration', r1.ok && r1.fresh && S.activeSegment().durationMinutes === 10);
  check('fresh clock edit: 10:00 of 10:00', S.state.remaining === 600 && S.state.total === 600);
  check('fresh clock edit makes session dirty', A.isDirty());
  A.save();
  A.play();
  advance(100);
  A.pause();
  const r2 = A.setClock(300);
  check('mid-segment edit changes time left only', r2.ok && !r2.fresh && S.state.remaining === 300 && S.state.total === 600);
  check('mid-segment edit leaves duration', S.activeSegment().durationMinutes === 10 && !A.isDirty());
  A.setClock(900);
  check('mid-segment edit can raise the total', S.state.remaining === 900 && S.state.total === 900);
  A.play();
  check('clock edit blocked while running', A.setClock(60).reason === 'running');
}

/* ── editing segments ──────────────────────────────────────── */
{
  const { S, E, A, advance } = world();
  S.load();
  check('empty title refused', A.editSegment(1, { title: '   ' }).reason === 'title');
  A.editSegment(1, { title: 'Deep Work' });
  check('title edit', S.segmentAt(1).title === 'Deep Work' && A.isDirty());
  A.play();
  advance(20);
  check('current length locked while running', A.editSegment(0, { seconds: 240 }).reason === 'running');
  check('other lengths editable while running', A.editSegment(2, { seconds: 420 }).ok && S.segmentAt(2).durationMinutes === 7);
  check('add blocked while running', A.addSegment().reason === 'running');
  check('delete blocked while running', A.deleteSegment(2).reason === 'running');
  check('move blocked while running', A.moveSegment(1, 2).reason === 'running');
  A.pause();
  A.editSegment(0, { seconds: 240 });
  check('current length edit resets clock', S.state.remaining === 240 && S.state.total === 240 && !E.isRunning());
  const add = A.addSegment();
  check('add: 5-minute New Segment at the end', add.ok && S.segments().length === 6 && S.segmentAt(5).durationMinutes === 5);
  A.jump(3);
  A.deleteSegment(1);
  check('delete before current shifts index', S.state.segmentIndex === 2 && S.activeSegment().title === 'Focus Block');
  A.deleteSegment(2);
  check('delete current resets to next', S.state.segmentIndex === 2 && S.state.remaining === U_seconds(S.activeSegment()));
  A.moveSegment(2, 0);
  check('moving current follows it', S.state.segmentIndex === 0);
  while (S.segments().length > 1) A.deleteSegment(S.segments().length - 1);
  check('last segment cannot be deleted', A.deleteSegment(0).reason === 'last');
  check('bad sound key ignored', A.editSegment(0, { soundKey: 'x y<' }).ok && S.segmentAt(0).soundKey === 'default');
  check('bad theme falls back to default', A.editSegment(0, { theme: 'neon' }).ok && S.segmentAt(0).theme === 'default');
}
function U_seconds(seg) { return seg.durationMinutes * 60 + seg.durationSeconds; }

/* ── sessions: save, save as, revert, new, duplicate, delete ── */
{
  const { S, A } = world();
  S.load();
  const original = S.activeSession();
  A.editSegment(0, { title: 'Arrive' });
  const sa = A.saveAs('Morning Focus');
  check('save as: new active session', sa.ok && S.activeSession().name === 'Morning Focus' && !A.isDirty());
  check('save as: copy has the edit', S.activeSession().segments[0].title === 'Arrive');
  check('save as: original reverted', original.segments[0].title === 'Set Intentions' && !S.isDirty(original));
  check('save as: taken name refused', A.saveAs('morning focus').reason === 'taken');
  A.renameSession('Morning Focus II');
  check('rename marks dirty', A.isDirty() && S.activeSession().name === 'Morning Focus II');
  A.revert();
  check('revert restores name', S.activeSession().name === 'Morning Focus' && !A.isDirty());
  const n = A.newSession();
  check('new session: unsaved, one 25-min segment', n.ok && A.isDirty() && S.segments().length === 1 && S.state.remaining === 1500);
  const count = S.sessions.length;
  const rv = A.revert();
  check('revert of a never-saved session discards it', rv.discarded && S.sessions.length === count - 1);
  const d1 = A.duplicate(S.sessions[0].id);
  const d2 = A.duplicate(S.sessions[0].id);
  check('duplicate naming', d1.session.name.endsWith('(copy)') && d2.session.name.endsWith('(copy 2)'));
  A.load(d1.session.id);
  check('load activates at segment 1', S.activeSession().id === d1.session.id && S.state.segmentIndex === 0);
  const del = A.deleteSession(d1.session.id);
  check('deleting the active session loads the first', del.wasActive && S.activeSession().id === S.sessions[0].id);
  while (S.sessions.length > 1) A.deleteSession(S.sessions[S.sessions.length - 1].id);
  check('last session cannot be deleted', A.deleteSession(S.sessions[0].id).reason === 'last');
}

/* ── import / export ───────────────────────────────────────── */
{
  const { S, A } = world();
  S.load();
  check('import rejects non-arrays', A.importSessions({}).reason === 'format');
  const res = A.importSessions([
    { name: 'Sprint', segments: [{ title: 'Go', durationMinutes: 5000.7, durationSeconds: 99, soundEnabled: 1, soundKey: 'bad key!', autoAdvance: 0, theme: 'neon' }] },
    { name: 'Focus Session (60 min)', segments: [{ title: 'dup', durationMinutes: 1 }] },
    { name: 'Empty', segments: [{ title: 'zero', durationMinutes: 0, durationSeconds: 0 }] },
    { name: 'No segments' },
    null
  ]);
  check('import counts', res.added === 1 && res.skipped === 4, res);
  const sprint = S.sessions.find(s => s.name === 'Sprint');
  const seg = sprint && sprint.segments[0];
  check('import sanitizes', seg && seg.durationMinutes === 5000 && seg.durationSeconds === 59 && seg.soundKey === 'default' &&
    seg.theme === 'default' && seg.soundEnabled === true && seg.autoAdvance === false, seg);
  const out = A.exportData();
  check('export: original format, no ids', out.length === 4 && !('id' in out[0].segments[0]) && out[0].segments[0].durationMinutes === 3);
}

/* ── migration from the original app ───────────────────────── */
{
  const legacySessions = [
    { name: 'Classic', segments: [
      { title: 'One', durationMinutes: 10, durationSeconds: 0, soundEnabled: true, soundKey: 'gentle-bell', autoAdvance: true, theme: 'default' },
      { title: 'Two', durationMinutes: 25, durationSeconds: 0, soundEnabled: false, soundKey: 'default', autoAdvance: false, theme: 'starryNight' }
    ] }
  ];
  const legacyState = { currentSessionName: 'Classic', currentSegmentIndex: 1, timerSeconds: 100, timerTotal: 1500,
    theme: 'starryNight', globalMute: true, panelCollapsed: true };
  const { S, data } = world({ joypro_sessions: JSON.stringify(legacySessions), joypro_state: JSON.stringify(legacyState) });
  const res = S.load();
  check('migrated', res.migrated === true);
  check('migrated session', S.sessions.length === 1 && S.activeSession().name === 'Classic');
  check('migrated position', S.state.segmentIndex === 1 && S.state.remaining === 100 && S.state.total === 1500);
  check('migrated settings', S.state.theme === 'starryNight' && S.state.muted && S.state.ribbonCollapsed);
  check('migrated fields', S.segmentAt(1).theme === 'starryNight' && S.segmentAt(0).soundKey === 'gentle-bell');
  check('migrated sessions are clean', !S.isDirty(S.activeSession()));
  check('legacy keys left untouched', data.get('joypro_sessions') === JSON.stringify(legacySessions));

  const older = [{ name: 'Old Shape', sessions: [{ title: 'A', durationMinutes: 1, durationSeconds: 0 }] }];
  const w2 = world({ joypro_sequences: JSON.stringify(older) });
  w2.S.load();
  check('migrates sequences/sessions naming', w2.S.activeSession().name === 'Old Shape' && w2.S.segments().length === 1);

  const w3 = world({ 'joypro2.migrated': '1', joypro_sessions: JSON.stringify(legacySessions) });
  w3.S.load();
  check('migration runs only once', w3.S.sessions.length === 3 && w3.S.activeSession().name === 'Focus Session (60 min)');
}

/* ── regressions found in the 2026-11-19 code review ───────── */
{
  // Pausing in the instant after a segment really ended still ends it properly.
  const { S, E, A, moveClock, events } = world();
  S.load();
  A.play();
  moveClock(180.2); // the heartbeat hasn't noticed yet
  A.pause();
  check('pause at the boundary fires segmentEnd', events.some(e => e.type === 'segmentEnd' && e.d.index === 0));
  check('pause at the boundary loads the next segment, paused', S.state.segmentIndex === 1 && !E.isRunning() && S.state.remaining === 1500);
}
{
  // A mid-segment edit that raises the total must not later count as "not started".
  const { S, A, advance } = world();
  S.load();
  A.jump(1);
  A.play();
  advance(300);
  A.pause();
  A.setClock(1800); // 30:00 left, total raised to 30:00
  const r = A.setClock(1680); // 28:00
  check('second mid-segment edit still changes only the time left', !r.fresh && S.state.remaining === 1680 && S.activeSegment().durationMinutes === 25 && !A.isDirty());
  check('a reload remembers the segment has started', S.state.started === true);
}
{
  // Revert follows the playing segment by identity, not position.
  const { S, E, A, advance } = world();
  S.load();
  A.deleteSegment(2); // remove "Break" (unsaved)
  A.jump(2); // the second Focus Block, now at index 2
  const playing = S.activeSegment().id;
  A.play();
  advance(60);
  A.revert(); // "Break" comes back, so that Focus Block is index 3 again
  check('revert keeps the same segment playing', S.activeSegment().id === playing && S.state.segmentIndex === 3);
  check('revert keeps its clock running', E.isRunning() && S.state.remaining === 1440);
}
{
  // Long names: copies always fit in 100 characters and stay unique.
  const { S, A } = world();
  S.load();
  const long = 'L'.repeat(100);
  A.renameSession(long);
  A.save();
  const sug = A.suggestCopyName(long);
  check('copy name fits in 100 characters', sug.length <= 100 && sug.endsWith(' (copy)'));
  const sa = A.saveAs(sug);
  check('save as with a suggested copy name succeeds', sa.ok && S.activeSession().name === sug);
  const d1 = A.duplicate(S.sessions[0].id);
  const d2 = A.duplicate(S.sessions[0].id);
  check('duplicates of long names stay unique', d1.session.name !== d2.session.name && !S.sessions.some((s, i) => S.sessions.findIndex(x => x.name.toLowerCase() === s.name.toLowerCase()) !== i));
}

/* ── persistence round trip ────────────────────────────────── */
{
  const w1 = world();
  w1.S.load();
  w1.A.jump(2);
  w1.A.editSegment(2, { title: 'Stretch' });
  w1.A.setTheme('dark');
  const snapshot = Object.fromEntries(w1.data);
  const w2 = world(snapshot);
  w2.S.load();
  check('reload keeps position', w2.S.state.segmentIndex === 2 && w2.S.state.remaining === 300);
  check('reload keeps edits and dirty state', w2.S.segmentAt(2).title === 'Stretch' && w2.S.isDirty(w2.S.activeSession()));
  check('reload keeps theme', w2.S.state.theme === 'dark');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) {
  failures.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
