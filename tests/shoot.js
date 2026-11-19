/* ═══════════════════════════════════════════════════════════════
   Headless screenshots and console checks, with no visible window.
   Drives the installed Chrome over the DevTools protocol (Node 22+
   has WebSocket built in, so there's nothing to install).

     node tests/shoot.js                 every scenario
     node tests/shoot.js tree themes     just these

   Shots land in _Workbench/_Inbox/shots/ (gitignored). Console
   errors and uncaught exceptions are printed and fail the run.
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '_Workbench', '_Inbox', 'shots');
const CHROME = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));
const INDEX = pathToFileURL(path.join(ROOT, 'index.html')).href;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((resolve, reject) => {
  http.get(url, res => {
    let d = '';
    res.on('data', c => { d += c; });
    res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
  }).on('error', reject);
});

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.n = 0;
    this.pending = new Map();
    this.listeners = [];
    this.ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message)); else p.resolve(msg.result);
      } else if (msg.method) {
        this.listeners.forEach(fn => fn(msg));
      }
    };
  }
  open() { return new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; }); }
  send(method, params) {
    const id = ++this.n;
    this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  once(method) {
    return new Promise(resolve => {
      const fn = msg => {
        if (msg.method === method) {
          this.listeners = this.listeners.filter(f => f !== fn);
          resolve(msg.params);
        }
      };
      this.listeners.push(fn);
    });
  }
  close() { try { this.ws.close(); } catch (e) { /* ignore */ } }
}

/* ── Scenarios ─────────────────────────────────────────────── */
const DAY = [0, 0.12, 0.3, 0.5, 0.68, 0.8, 0.875, 0.92, 0.96, 1];

/* Built in the page from the scene canvas: one row per tree, one column
   per stage, each cell the pot and the foot of the trunk. Returns a PNG
   data URL for a step's `save`. */
const potSheet = (seeds, stages) => `(async () => {
  const sc = JP.ui.currentScene();
  const g = sc.debug.geometry();
  const src = document.getElementById('scene');
  const seeds = ${JSON.stringify(seeds)};
  const stages = ${JSON.stringify(stages)};
  const cw = Math.round(g.scale * 0.84);
  const ch = Math.round(g.scale * 0.62);
  const out = document.createElement('canvas');
  out.width = cw * stages.length * g.dpr;
  out.height = ch * seeds.length * g.dpr;
  const o = out.getContext('2d');
  const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  for (let i = 0; i < seeds.length; i++) {
    sc.debug.reseed(seeds[i]);
    for (let j = 0; j < stages.length; j++) {
      sc.debug.setProgress(stages[j]);
      await frames();
      o.drawImage(src, (g.cx - 0.42 * g.scale) * g.dpr, (g.soilY - 0.42 * g.scale) * g.dpr, cw * g.dpr, ch * g.dpr, j * cw * g.dpr, i * ch * g.dpr, cw * g.dpr, ch * g.dpr);
    }
  }
  return out.toDataURL('image/png');
})()`;
const SCENARIOS = {
  // The Growing Tree through a whole day, on a fresh first-run app
  tree: {
    size: [1440, 900],
    query: '?lab&notour',
    shots: DAY.map(p => ({ name: 'tree-' + String(Math.round(p * 1000)).padStart(4, '0'), eval: `JP.ui.currentScene().debug.setProgress(${p})`, wait: 900 }))
  },
  // The same day without the lab panel, for showing people
  day: {
    size: [1440, 900],
    query: '?notour',
    shots: [0, 0.14, 0.4, 0.66, 0.8, 0.875, 0.93, 1].map(p => ({
      name: 'day-' + String(Math.round(p * 1000)).padStart(4, '0'),
      eval: 'JP.ui.currentScene().debug.setProgress(' + p + ')' + (p === 0.8 ? '; JP.ui.currentScene().debug.sunFace("peek")' : '') + (p === 0.4 ? '; JP.ui.currentScene().debug.bird()' : ''),
      wait: p === 0.4 ? 4300 : p === 0.8 ? 2400 : 1100
    }))
  },
  // 64 frames from dawn to night, for an animated time-lapse
  timelapse: {
    size: [1440, 900],
    query: '?notour',
    shots: Array.from({ length: 64 }, (_, i) => ({
      name: 'tl-' + String(i).padStart(3, '0'),
      eval: 'JP.ui.currentScene().debug.setProgress(' + (i / 63).toFixed(4) + ')',
      wait: 260
    }))
  },
  // Visitors on cue
  visitors: {
    size: [1440, 900],
    query: '?lab&notour',
    shots: [
      { name: 'visit-peek', eval: 'JP.ui.currentScene().debug.setProgress(0.4); JP.ui.currentScene().debug.sunFace("peek")', wait: 2300 },
      { name: 'visit-yawn', eval: 'JP.ui.currentScene().debug.setProgress(0.82); JP.ui.currentScene().debug.sunFace("yawn")', wait: 2000 },
      { name: 'visit-bird', eval: 'JP.ui.currentScene().debug.setProgress(0.6); JP.ui.currentScene().debug.bird()', wait: 4200 },
      { name: 'visit-night', eval: 'JP.ui.currentScene().debug.setProgress(0.985)', wait: 3500 },
      { name: 'visit-burst', eval: 'JP.ui.currentScene().debug.setProgress(1); JP.ui.currentScene().debug.burst()', wait: 700 }
    ]
  },
  // Every theme, and the app's own surfaces
  themes: {
    size: [1440, 900],
    query: '?notour',
    shots: [
      { name: 'theme-light', eval: 'JP.actions.setTheme("light")', wait: 1600 },
      { name: 'theme-dark', eval: 'JP.actions.setTheme("dark")', wait: 1600 },
      { name: 'theme-starry', eval: 'JP.actions.setTheme("starryNight")', wait: 1800 },
      { name: 'theme-tree', eval: 'JP.actions.setTheme("growingTree")', wait: 1800 }
    ]
  },
  surfaces: {
    size: [1440, 900],
    query: '?notour',
    shots: [
      { name: 'ui-running', eval: 'JP.actions.jump(1); JP.actions.play()', wait: 2600 },
      { name: 'ui-sheet', eval: 'JP.actions.pause(); JP.ui.openSheet(); document.querySelector(".seg-row:nth-child(2) .seg-more").click()', wait: 900 },
      { name: 'ui-sessions', eval: 'JP.ui.closeSheet(); JP.ui.openSessions()', wait: 700 },
      { name: 'ui-sounds', eval: 'document.getElementById("sessionsDlg").close(); JP.ui.openSounds()', wait: 700 },
      { name: 'ui-help', eval: 'document.getElementById("soundsDlg").close(); JP.ui.openHelp()', wait: 700 },
      { name: 'ui-edit-clock', eval: 'document.getElementById("helpDlg").close(); document.getElementById("clock").dispatchEvent(new MouseEvent("dblclick", {bubbles: true}))', wait: 600 },
      { name: 'ui-complete', eval: 'document.activeElement.blur(); JP.actions.jump(4); JP.actions.setClock(1); JP.actions.play()', wait: 3200 },
      { name: 'ui-theme-menu', eval: 'JP.actions.reset(); document.getElementById("themeBtn").click()', wait: 700 }
    ]
  },
  intro: {
    size: [1440, 900],
    query: '',
    shots: [
      { name: 'intro-1', eval: '', wait: 2200 },
      { name: 'intro-4', eval: 'for (let i = 0; i < 3; i++) document.getElementById("introNext").click()', wait: 900 }
    ]
  },
  phone: {
    size: [390, 844],
    mobile: true,
    query: '?notour',
    shots: [
      { name: 'phone-tree', eval: 'JP.ui.currentScene() && JP.ui.currentScene().debug.setProgress(0.62)', wait: 1600 },
      { name: 'phone-sheet', eval: 'JP.ui.openSheet()', wait: 900 },
      { name: 'phone-dark', eval: 'JP.ui.closeSheet(); JP.actions.setTheme("dark")', wait: 1400 }
    ]
  },
  short: {
    size: [1366, 680],
    query: '?lab&notour&p=0.88',
    shots: [{ name: 'short-laptop', eval: '', wait: 1800 }]
  },
  // Regressions found in the 2026-11-19 code review
  regress: {
    size: [1440, 900],
    query: '?notour',
    shots: [
      { eval: 'JP.actions.setTheme("light"); JP.actions.setTheme("growingTree")', wait: 1100,
        check: 'document.documentElement.dataset.theme === "growingTree" && !!JP.ui.currentScene() && document.getElementById("scene").classList.contains("is-on")',
        label: 'a quick Light → Growing Tree still ends on the tree scene' },
      { eval: 'JP.actions.setTheme("starryNight")', wait: 1100 },
      { eval: 'JP.actions.setTheme("growingTree"); JP.actions.setTheme("starryNight")', wait: 1100,
        check: 'document.documentElement.dataset.theme === "starryNight" && /0b0e2a|rgb\\(11, 14, 42\\)/i.test(document.getElementById("scene").style.background)',
        label: 'a quick Starry → Tree → Starry keeps the starry scene' },
      { eval: 'JP.actions.setTheme("growingTree")', wait: 1100 },
      { clickAt: '#themeBtn', wait: 400, check: 'document.getElementById("themeMenu").matches(":popover-open")', label: 'clicking Theme opens its menu' },
      { clickAt: '#themeBtn', wait: 400, check: '!document.getElementById("themeMenu").matches(":popover-open")', label: 'clicking Theme again closes it' },
      { eval: 'JP.actions.setClock(3); JP.actions.play()', keys: ['KeyN'], wait: 4300,
        check: 'document.getElementById("confirmDlg").open && JP.store.state.segmentIndex === 1',
        label: 'the segment ends behind the open Skip dialog' },
      { keys: ['Enter'], wait: 400,
        check: 'JP.store.state.segmentIndex === 1 && [...document.querySelectorAll(".toast-text")].some(t => /already ended/.test(t.textContent))',
        label: 'confirming then skips nothing more' },
      { eval: 'JP.actions.pause(); JP.ui.openSheet()', wait: 400 },
      { eval: 'var i = document.querySelector(".seg-row .seg-title-input"); i.focus(); i.setSelectionRange(i.value.length, i.value.length)', wait: 150 },
      { insert: ' XYZ', wait: 250, check: 'JP.store.segmentAt(0).title === "Set Intentions XYZ"', label: 'titles still save as you type' },
      { keys: ['Escape'], wait: 300, check: 'JP.store.segmentAt(0).title === "Set Intentions" && JP.ui.isSheetOpen()', label: 'Esc puts the title back' },
      { eval: 'JP.actions.jump(4); JP.actions.setClock(1); var i = document.querySelector(".seg-row .seg-title-input"); i.focus(); JP.actions.play()', wait: 2400,
        check: 'JP.engine.isCompleted() && document.activeElement.classList.contains("seg-title-input")',
        label: 'the completion screen doesn’t steal focus from typing' },
      { eval: 'document.activeElement.blur(); JP.ui.closeSheet()', wait: 900,
        check: 'document.activeElement && document.activeElement.id === "restartBtn" || !JP.ui.isSheetOpen()', label: 'and the editor closes cleanly afterward' }
    ]
  },
  // The mini timer (headless, so nothing appears on screen): it opens, sets up, and keeps in sync
  mini: {
    size: [1440, 900],
    query: '?notour',
    shots: [
      { eval: 'JP.ui.togglePopout()', gesture: true, wait: 1200,
        check: '[...document.querySelectorAll(".toast-text")].some(t => /Mini timer open/.test(t.textContent))', label: 'the mini timer opens and sets itself up' },
      { eval: 'JP.actions.play()', wait: 2200, check: 'JP.engine.isRunning()', label: 'it keeps running alongside (no errors while syncing)' },
      { eval: 'JP.ui.togglePopout()', gesture: true, wait: 400, check: '[...document.querySelectorAll(".toast-text")].filter(t => /Mini timer open/.test(t.textContent)).length === 1', label: 'a second click focuses it instead of opening another' }
    ]
  },
  // The engine's heartbeat worker must start from file:// (else hidden tabs fall back to throttled timers)
  worker: {
    size: [800, 600],
    query: '?notour',
    shots: [
      { eval: 'window.__beat = false; try { var w = new Worker(URL.createObjectURL(new Blob(["setTimeout(function(){postMessage(1)}, 50)"], {type: "text/javascript"}))); w.onmessage = function(){ window.__beat = true; }; w.onerror = function(){ window.__beat = "error"; }; } catch (e) { window.__beat = "threw: " + e.message; }', wait: 600,
        check: 'window.__beat === true', label: 'a Blob worker runs from file://' }
    ]
  },
  // Six trees in their pots at four stages, on one sheet: how each trunk meets the soil
  pots: {
    size: [1440, 900],
    query: '?notour',
    dpr: 2,
    media: [{ name: 'prefers-reduced-motion', value: 'reduce' }], // no sway, no crossfade between trees
    shots: [{ eval: potSheet(['pot-1', 'pot-2', 'pot-3', 'pot-4', 'pot-5', 'pot-6'], [0.08, 0.3, 0.6, 0.85]), save: 'pots', wait: 100 }]
  },
  // Reduced motion: no sway or visitors, growth still shows, nothing breaks
  still: {
    size: [1440, 900],
    query: '?lab&notour',
    media: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    shots: [
      { eval: 'JP.ui.currentScene().debug.setProgress(0.7)', wait: 1200, name: 'still-tree',
        check: 'matchMedia("(prefers-reduced-motion: reduce)").matches', label: 'reduced motion is on' }
    ]
  },
  // First run over the original app's data: sessions, settings, an old-style custom sound
  migrate: {
    size: [1440, 900],
    query: '?notour',
    shots: [
      { eval: 'localStorage.clear(); localStorage.setItem("joypro_sessions", JSON.stringify([{name: "Classic", segments: [{title: "One", durationMinutes: 10, durationSeconds: 0, soundEnabled: true, soundKey: "custom:abc", autoAdvance: true, theme: "default"}, {title: "Two", durationMinutes: 5, durationSeconds: 0, soundEnabled: false, soundKey: "default", autoAdvance: false, theme: "starryNight"}]}])); localStorage.setItem("joypro_state", JSON.stringify({currentSessionName: "Classic", currentSegmentIndex: 0, timerSeconds: 400, timerTotal: 600, theme: "dark", globalMute: false})); localStorage.setItem("joypro_custom_sounds", JSON.stringify({abc: {name: "Ding", data: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="}}))', wait: 200 },
      { reload: true, wait: 1800, check: 'JP.store.activeSession().name === "Classic" && JP.store.state.theme === "dark" && JP.store.state.remaining === 400', label: 'sessions, theme and time left come across' },
      { check: 'JP.sounds.library().length === 1 && JP.sounds.library()[0].name === "Ding" && JP.store.segmentAt(0).soundKey === "custom:" + JP.sounds.library()[0].id', label: 'the old custom sound joins the Sound Library, still attached to its segment' },
      { check: 'localStorage.getItem("joypro_sessions").indexOf("Classic") > 0', label: 'the original’s data is left untouched' },
      { name: 'migrate', wait: 200 }
    ]
  },
  // Real behavior in a real browser: keys, dialogs, the editor, persistence.
  flow: {
    size: [1440, 900],
    query: '?notour',
    shots: [
      { check: 'JP.store.state.segmentIndex === 0 && !JP.engine.isRunning()', label: 'starts paused on segment 1' },
      { eval: 'JP.actions.setClock(2); JP.actions.play()', wait: 2700,
        check: 'JP.store.state.segmentIndex === 1 && JP.engine.isRunning()', label: 'auto-advances to segment 2 and keeps running' },
      { check: 'document.querySelector(".rb-seg").classList.contains("is-done")', label: 'ribbon marks segment 1 done' },
      { keys: ['Space'], wait: 300, check: '!JP.engine.isRunning()', label: 'Space pauses' },
      { keys: ['Space'], wait: 1300, check: 'JP.engine.isRunning() && JP.store.state.remaining < 1500', label: 'Space resumes and the clock moves' },
      { keys: ['KeyN'], wait: 400, check: 'document.getElementById("confirmDlg").open', label: 'N asks before skipping a running segment' },
      { keys: ['Enter'], wait: 400, check: 'JP.store.state.segmentIndex === 2 && JP.engine.isRunning()', label: 'Enter confirms the skip' },
      { keys: ['KeyE'], wait: 500, check: 'JP.ui.isSheetOpen()', label: 'E opens the editor' },
      { check: 'document.getElementById("addSegBtn").disabled', label: 'adding is locked while running' },
      { eval: 'JP.actions.pause(); var i = document.querySelector(".seg-row:nth-child(4) .seg-dur-input"); i.value = "7"; i.dispatchEvent(new Event("change", {bubbles: true}))', wait: 200,
        check: 'JP.store.segmentAt(3).durationMinutes === 7 && JP.actions.isDirty()', label: 'typing 7 sets a 7-minute length and marks unsaved' },
      { eval: 'document.getElementById("addSegBtn").click()', wait: 300,
        check: 'JP.store.segments().length === 6 && document.activeElement.classList.contains("seg-title-input")', label: 'Add segment appends one and focuses its title' },
      { eval: 'var t = document.activeElement; t.value = "Stretch"; t.dispatchEvent(new Event("input", {bubbles: true}))', wait: 200,
        check: 'JP.store.segmentAt(5).title === "Stretch"', label: 'titles edit live' },
      { keys: ['Enter'], wait: 200, check: '!document.activeElement.matches("input") && JP.store.segmentAt(5).title === "Stretch"', label: 'Enter keeps the title and leaves the field' },
      { eval: 'document.getElementById("sheetSave").click()', wait: 200, check: '!JP.actions.isDirty()', label: 'Save clears unsaved changes' },
      { eval: 'JP.actions.editSegment(3, {theme: "dark"}); JP.actions.jump(3)', wait: 900,
        check: 'document.documentElement.dataset.theme === "dark"', label: 'a segment’s own theme takes over' },
      { eval: 'JP.actions.jump(2)', wait: 900, check: 'document.documentElement.dataset.theme === "growingTree"', label: 'and hands back to the global theme' },
      { eval: 'document.getElementById("sheetName").focus()', wait: 150 },
      { keys: ['Escape'], wait: 200, check: 'JP.ui.isSheetOpen() && !document.activeElement.matches("input")', label: 'Esc in a field leaves the field first' },
      { keys: ['Escape'], wait: 300, check: '!JP.ui.isSheetOpen()', label: 'a second Esc closes the editor' },
      { keys: ['KeyM'], wait: 200, check: 'JP.store.state.muted === true', label: 'M mutes' },
      { reload: true, wait: 1500, check: 'JP.store.state.muted === true && JP.store.state.segmentIndex === 2 && JP.store.segmentAt(5).title === "Stretch"', label: 'everything survives a reload' },
      { name: 'flow-end', wait: 300 }
    ]
  }
};

const KEYS = {
  Space: { key: ' ', code: 'Space', vk: 32 },
  Enter: { key: 'Enter', code: 'Enter', vk: 13, text: '\r' },
  Escape: { key: 'Escape', code: 'Escape', vk: 27 },
  KeyN: { key: 'n', code: 'KeyN', vk: 78 },
  KeyE: { key: 'e', code: 'KeyE', vk: 69 },
  KeyM: { key: 'm', code: 'KeyM', vk: 77 }
};

async function run(name, sc, port) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'joypro-shoot-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
    '--autoplay-policy=no-user-gesture-required', '--window-size=' + sc.size.join(','), 'about:blank'
  ], { stdio: 'ignore' });
  const problems = [];
  try {
    let page = null;
    for (let i = 0; i < 80 && !page; i++) {
      try {
        const list = await getJSON('http://127.0.0.1:' + port + '/json/list');
        page = list.find(t => t.type === 'page');
      } catch (e) { /* not up yet */ }
      if (!page) await sleep(100);
    }
    if (!page) throw new Error('Chrome did not start');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.open();
    cdp.listeners.push(msg => {
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        problems.push('exception: ' + ((d.exception && d.exception.description) || d.text));
      } else if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) {
        problems.push('console.' + msg.params.type + ': ' + msg.params.args.map(a => a.value || a.description).join(' '));
      } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
        const e = msg.params.entry;
        if (!/fonts\.(googleapis|gstatic)/.test(e.url || '')) problems.push('log: ' + e.text + (e.url ? ' (' + e.url + ')' : ''));
      }
    });
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Log.enable');
    // Behave like a focused desktop window, so focus and blur events fire
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: sc.size[0], height: sc.size[1], deviceScaleFactor: sc.dpr || (sc.mobile ? 2 : 1), mobile: !!sc.mobile
    });
    if (sc.media) await cdp.send('Emulation.setEmulatedMedia', { features: sc.media });
    const loaded = cdp.once('Page.loadEventFired');
    await cdp.send('Page.navigate', { url: INDEX + sc.query });
    await loaded;
    await sleep(1600);
    fs.mkdirSync(OUT, { recursive: true });
    for (const shot of sc.shots) {
      if (shot.reload) {
        const again = cdp.once('Page.loadEventFired');
        await cdp.send('Page.reload', {});
        await again;
      }
      if (shot.eval) {
        const r = await cdp.send('Runtime.evaluate', { expression: shot.eval, awaitPromise: true, returnByValue: true, userGesture: !!shot.gesture });
        if (r.exceptionDetails) problems.push((shot.name || shot.label || shot.save) + ': ' + (r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text));
        else if (shot.save) {
          // The step built its own image and returned it as a PNG data URL
          const data = String(r.result && r.result.value || '').replace(/^data:image\/png;base64,/, '');
          if (!data) problems.push(shot.save + ': no image came back');
          else {
            const file = path.join(OUT, shot.save + '.png');
            fs.writeFileSync(file, Buffer.from(data, 'base64'));
            console.log('  sheet ' + path.relative(ROOT, file));
          }
        }
      }
      if (shot.clickAt) {
        // A real mouse click at the element's center (pointer events, light dismiss and all)
        const r = await cdp.send('Runtime.evaluate', {
          expression: '(() => { const r = document.querySelector(' + JSON.stringify(shot.clickAt) + ').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()',
          returnByValue: true
        });
        const [x, y] = r.result.value;
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
        await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      }
      if (shot.insert) await cdp.send('Input.insertText', { text: shot.insert });
      for (const k of shot.keys || []) {
        const d = KEYS[k];
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: d.key, code: d.code, windowsVirtualKeyCode: d.vk, text: d.text || (d.key.length === 1 ? d.key : undefined) });
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: d.key, code: d.code, windowsVirtualKeyCode: d.vk });
      }
      await sleep(shot.wait || (shot.check && !shot.eval && !shot.keys ? 50 : 600));
      if (shot.check) {
        const r = await cdp.send('Runtime.evaluate', { expression: '!!(' + shot.check + ')', returnByValue: true });
        const okay = r.result && r.result.value === true;
        console.log('  ' + (okay ? '✓' : '✗') + ' ' + shot.label);
        if (!okay) problems.push('check failed: ' + shot.label);
      }
      if (shot.name) {
        const img = await cdp.send('Page.captureScreenshot', { format: 'png' });
        const file = path.join(OUT, shot.name + '.png');
        fs.writeFileSync(file, Buffer.from(img.data, 'base64'));
        console.log('  shot ' + path.relative(ROOT, file));
      }
    }
    cdp.close();
  } finally {
    chrome.kill();
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* Chrome may still hold it */ }
  }
  return problems;
}

(async () => {
  if (!CHROME) { console.error('No Chrome or Edge found; set CHROME to its path.'); process.exit(2); }
  const want = process.argv.slice(2);
  const names = want.length ? want : Object.keys(SCENARIOS);
  let port = 9333;
  let failed = 0;
  for (const name of names) {
    const sc = SCENARIOS[name];
    if (!sc) { console.error('Unknown scenario: ' + name); failed++; continue; }
    console.log(name + ':');
    const problems = await run(name, sc, port++);
    problems.forEach(p => console.log('  ✗ ' + p));
    failed += problems.length;
  }
  console.log(failed ? '\n' + failed + ' problem(s)' : '\nNo console errors.');
  process.exit(failed ? 1 : 0);
})();
