/* ═══════════════════════════════════════════════════════════════
   JoyPro Timer Reloaded · sounds.js
   Chimes and the custom Sound Library.

   Playback uses plain HTML5 Audio elements, one reused element per
   sound (Adam's simple-audio-playback convention): no AudioContext,
   no decoding pipeline. Custom sounds are stored as data URLs in
   IndexedDB (localStorage fallback) and played straight from them.
   ═══════════════════════════════════════════════════════════════ */
(function (JP) {
  'use strict';

  const U = JP.util;
  const S = JP.store;

  const BUILT_IN = [
    { key: 'default', label: 'Classic Chime', file: 'sounds/segment-finished.mp3' },
    { key: 'gentle-bell', label: 'Gentle Bell', file: 'sounds/gentle-bell.wav' },
    { key: 'digital-beep', label: 'Digital Beep', file: 'sounds/digital-beep.wav' },
    { key: 'wooden-block', label: 'Wooden Block', file: 'sounds/wooden-block.wav' },
    { key: 'singing-bowl', label: 'Singing Bowl', file: 'sounds/singing-bowl.wav' }
  ];

  const KEY = { library: 'joypro2.soundLibrary', lsData: 'joypro2.soundData', migrated: 'joypro2.soundsMigrated' };
  const LEGACY = { library: 'joypro_sound_library', custom: 'joypro_custom_sounds', lsData: 'joypro_sound_data', db: 'joypro_sounds' };
  const DB_NAME = 'joypro2_sounds';
  const STORE = 'audio';

  const MB = 1024 * 1024;
  const BUDGETS = {
    idb: { total: 20 * MB, perFile: 2 * MB, max: 30 },
    ls: { total: 3 * MB, perFile: 500 * 1024, max: 6 }
  };

  let library = []; // [{ id, name, type: 'audio', format, size, dateAdded }]
  let db = null;
  const customAudio = new Map(); // id → HTMLAudioElement

  /* ── IndexedDB, wrapped in promises ────────────────────────── */
  function openDB(name) {
    return new Promise(resolve => {
      try {
        const req = indexedDB.open(name, 1);
        req.onupgradeneeded = e => {
          const d = e.target.result;
          if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' });
        };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }
  function idb(d, mode, fn) {
    return new Promise((resolve, reject) => {
      try {
        const tx = d.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  /* ── Binary store (IndexedDB, else localStorage) ───────────── */
  const lsAll = () => S.readJSON(KEY.lsData) || {};
  const blobs = {
    put(id, data) {
      if (db) return idb(db, 'readwrite', st => st.put({ id, data }));
      const all = lsAll();
      all[id] = data;
      return S.storage.set(KEY.lsData, JSON.stringify(all)) ? Promise.resolve() : Promise.reject(new Error('quota'));
    },
    get(id) {
      if (db) return idb(db, 'readonly', st => st.get(id)).then(r => (r ? r.data : null));
      return Promise.resolve(lsAll()[id] || null);
    },
    del(id) {
      if (db) return idb(db, 'readwrite', st => st.delete(id));
      const all = lsAll();
      delete all[id];
      S.storage.set(KEY.lsData, JSON.stringify(all));
      return Promise.resolve();
    }
  };

  function saveLibrary() {
    S.storage.set(KEY.library, JSON.stringify(library));
    S.emit('sounds', {});
  }

  function cleanMeta(m) {
    if (!m || typeof m !== 'object' || typeof m.id !== 'string' || !/^[\w-]{1,64}$/.test(m.id)) return null;
    return {
      id: m.id,
      name: typeof m.name === 'string' && m.name.trim() ? m.name.trim().slice(0, 80) : 'Custom Sound',
      type: 'audio',
      format: m.format === 'wav' ? 'wav' : 'mp3',
      size: Math.max(0, parseInt(m.size, 10) || 0),
      dateAdded: parseInt(m.dateAdded, 10) || Date.now()
    };
  }

  /* ── Migration from the original app (once) ─────────────────── */
  async function migrate() {
    if (S.storage.get(KEY.migrated) === '1') return 0;
    if (library.length) { S.storage.set(KEY.migrated, '1'); return 0; }
    let count = 0;

    const legacyMeta = S.readJSON(LEGACY.library);
    if (Array.isArray(legacyMeta) && legacyMeta.length) {
      // The original's database exists only if it holds sounds, so opening it can't create a stray one.
      const old = await openDB(LEGACY.db);
      const oldLs = S.readJSON(LEGACY.lsData) || {};
      for (const raw of legacyMeta) {
        const meta = cleanMeta(raw);
        if (!meta) continue;
        let data = null;
        if (old) data = await idb(old, 'readonly', st => st.get(meta.id)).then(r => (r ? r.data : null)).catch(() => null);
        if (!data) data = oldLs[meta.id] || null;
        if (!data) continue;
        try {
          await blobs.put(meta.id, data); // same id, so sessions' "custom:<id>" keys still match
          library.push(meta);
          count++;
        } catch (e) { /* skip this one */ }
      }
      if (old) old.close();
    } else {
      // Older still: data URLs kept straight in localStorage.
      const custom = S.readJSON(LEGACY.custom);
      if (custom && typeof custom === 'object') {
        for (const oldKey of Object.keys(custom)) {
          const val = custom[oldKey];
          const data = typeof val === 'string' ? val : val && val.data;
          if (!data || !/^data:audio\//.test(data)) continue;
          const id = U.uid('snd');
          try {
            await blobs.put(id, data);
            library.push({
              id,
              name: (val && val.name) || 'Custom Sound',
              type: 'audio',
              format: /^data:audio\/(x-)?wav/.test(data) ? 'wav' : 'mp3',
              size: Math.round((data.length - data.indexOf(',') - 1) * 0.75),
              dateAdded: Date.now()
            });
            S.replaceSoundKey('custom:' + oldKey, 'custom:' + id);
            count++;
          } catch (e) { /* skip */ }
        }
      }
    }
    if (count) saveLibrary();
    // Marked done only now, so an interrupted first run tries again. Library sounds
    // keep the original's ids, so a retry overwrites them rather than duplicating.
    S.storage.set(KEY.migrated, '1');
    return count;
  }

  /* ── Playback ──────────────────────────────────────────────── */
  function builtinAudio(snd) {
    if (!snd.audio) {
      snd.audio = new Audio(snd.file);
      snd.audio.preload = 'auto';
    }
    return snd.audio;
  }

  function playElement(a) {
    try {
      a.currentTime = 0;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
  }

  function playBuiltin(key) {
    const snd = BUILT_IN.find(b => b.key === key) || BUILT_IN[0];
    playElement(builtinAudio(snd));
  }

  async function playCustom(id) {
    let a = customAudio.get(id);
    if (!a) {
      const data = await blobs.get(id);
      if (!data) throw new Error('missing sound');
      a = new Audio(data);
      a.preload = 'auto';
      customAudio.set(id, a);
    }
    playElement(a);
  }

  let lastChimeAt = 0;
  /**
   * Play a sound by key ("default", "gentle-bell", "custom:<id>").
   * A missing custom sound falls back to the Classic Chime.
   */
  function play(key, opts) {
    const preview = !!(opts && opts.preview);
    if (S.state.muted && !preview) return;
    if (!preview) {
      // When a background tab catches up on several segments at once, chime once.
      const t = Date.now();
      if (t - lastChimeAt < 1200) return;
      lastChimeAt = t;
    }
    const k = key || 'default';
    if (k.indexOf('custom:') === 0) {
      playCustom(k.slice(7)).catch(() => playBuiltin('default'));
      return;
    }
    playBuiltin(k);
  }

  const preview = key => play(key, { preview: true });

  /* ── Library management ────────────────────────────────────── */
  const budget = () => (db ? BUDGETS.idb : BUDGETS.ls);
  const usedBytes = () => library.reduce((a, s) => a + (s.size || 0), 0);

  const isAudioFile = file =>
    /^audio\/(mpeg|mp3|wav|x-wav|wave|vnd\.wave)$/.test(file.type || '') || /\.(mp3|wav)$/i.test(file.name || '');

  /** Why a file can't be added, or null if it can. */
  function checkFile(file, alreadyAddedBytes) {
    const b = budget();
    if (!isAudioFile(file)) return file.name + ': unsupported format (use MP3 or WAV)';
    if (file.size > b.perFile) return file.name + ': too large (max ' + formatSize(b.perFile) + ')';
    if (library.length >= b.max) return 'Sound Library is full (' + b.max + ' sounds)';
    if (usedBytes() + (alreadyAddedBytes || 0) + file.size > b.total) return 'Not enough room in the Sound Library';
    return null;
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  async function add(file, dataUrl, name) {
    const id = U.uid('snd');
    await blobs.put(id, dataUrl);
    const meta = {
      id,
      name: String(name || file.name).trim().slice(0, 80) || 'Custom Sound',
      type: 'audio',
      format: /\.wav$/i.test(file.name) || /wav/.test(file.type) ? 'wav' : 'mp3',
      size: file.size,
      dateAdded: Date.now()
    };
    library.push(meta);
    saveLibrary();
    return meta;
  }

  function rename(id, name) {
    const meta = library.find(s => s.id === id);
    const n = String(name || '').trim().slice(0, 80);
    if (!meta || !n) return false;
    meta.name = n;
    saveLibrary();
    return true;
  }

  async function remove(id) {
    const i = library.findIndex(s => s.id === id);
    if (i < 0) return false;
    library.splice(i, 1);
    customAudio.delete(id);
    saveLibrary();
    await blobs.del(id).catch(() => {});
    // Segments that used it fall back to the Classic Chime.
    if (S.replaceSoundKey('custom:' + id, 'default')) S.emit('segments', { soundRemoved: id });
    return true;
  }

  function labelFor(key) {
    if (key && key.indexOf('custom:') === 0) {
      const meta = library.find(s => s.id === key.slice(7));
      return meta ? meta.name : 'Classic Chime';
    }
    const b = BUILT_IN.find(x => x.key === key);
    return b ? b.label : 'Classic Chime';
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < MB) return Math.round(bytes / 1024) + ' KB';
    return (bytes / MB).toFixed(1) + ' MB';
  }

  async function init() {
    const meta = S.readJSON(KEY.library);
    library = Array.isArray(meta) ? meta.map(cleanMeta).filter(Boolean) : [];
    db = typeof indexedDB !== 'undefined' ? await openDB(DB_NAME) : null;
    let migrated = 0;
    try { migrated = await migrate(); } catch (e) { /* never block startup */ }
    S.on('segmentEnd', e => {
      if (e && e.segment && e.segment.soundEnabled) play(e.segment.soundKey);
    });
    // Warm the built-ins so the first chime is instant.
    BUILT_IN.forEach(builtinAudio);
    return { migrated };
  }

  JP.sounds = {
    BUILT_IN,
    init, play, preview,
    library: () => library,
    budget, usedBytes, checkFile, readFile, add, rename, remove, labelFor, formatSize
  };
})(window.JP = window.JP || {});
