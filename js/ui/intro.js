/* ═══════════════════════════════════════════════════════════════
   JoyPro Timer Reloaded · intro.js
   The first-run welcome tour (four slides, skippable) and the Help
   dialog. The tour shows once; Help can replay it.
   ═══════════════════════════════════════════════════════════════ */
(function (JP) {
  'use strict';

  const U = JP.util;
  const S = JP.store;
  const ui = (JP.ui = JP.ui || {});

  const dlg = U.$('#introDlg');
  const art = U.$('#introArt');
  const heading = U.$('#introHeading');
  const text = U.$('#introText');
  const dots = U.$('#introDots');
  const nextBtn = U.$('#introNext');
  const skipBtn = U.$('#introSkip');

  const SP = U.SPECTRUM;
  const spectrumDefs = id =>
    '<linearGradient id="' + id + '" x1="0" x2="1" y1="0" y2="0">' +
    SP.map((c, i) => '<stop offset="' + (i / (SP.length - 1)).toFixed(3) + '" stop-color="' + c + '"/>').join('') +
    '</linearGradient>';

  const SLIDES = [
    {
      title: 'Welcome to JoyPro Timer',
      body: 'A focus timer for sessions made of segments: set intentions, focus, take a break, wrap up. Press Space and it carries you through.',
      art: () =>
        '<svg viewBox="0 0 480 210" preserveAspectRatio="xMidYMid slice"><defs>' + spectrumDefs('ig1') +
        '<linearGradient id="ig1sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9A3CF"/><stop offset="1" stop-color="#FFD9B8"/></linearGradient></defs>' +
        '<rect width="480" height="210" fill="url(#ig1sky)"/>' +
        '<path d="M70 190 A170 170 0 0 1 410 190" fill="none" stroke="url(#ig1)" stroke-width="16" stroke-linecap="round" opacity=".9"/>' +
        '<path d="M110 190 A130 130 0 0 1 370 190" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="2 9" stroke-linecap="round" opacity=".6"/>' +
        '<image href="assets/joypro-logo.png" x="196" y="76" width="88" height="88" style="clip-path: inset(0 round 20px)"/>' +
        '</svg>'
    },
    {
      title: 'Your session at a glance',
      body: 'The ribbon along the bottom is the whole session, sized by time. Click any segment to jump to it. Finish a session and you’ll have painted the full JoyPro spectrum.',
      art: () => {
        const segs = [3, 25, 5, 25, 2];
        const total = segs.reduce((a, b) => a + b, 0);
        let x = 40;
        let bars = '';
        segs.forEach((m, i) => {
          const w = (m / total) * 400 - 4;
          const c = U.toHex(U.spectrum((segs.slice(0, i).reduce((a, b) => a + b, 0) + m / 2) / total));
          bars += '<rect x="' + x.toFixed(1) + '" y="128" width="' + w.toFixed(1) + '" height="14" rx="7" fill="' + c + '"' + (i > 1 ? ' opacity=".35"' : '') + '/>';
          if (i === 1) bars += '<rect x="' + x.toFixed(1) + '" y="124" width="' + (w * 0.6).toFixed(1) + '" height="22" rx="11" fill="' + c + '"/><circle cx="' + (x + w * 0.6).toFixed(1) + '" cy="135" r="9" fill="#fff" stroke="' + c + '" stroke-width="4"/>';
          x += w + 4;
        });
        return '<svg viewBox="0 0 480 210"><rect width="480" height="210" fill="#F6EFE4"/>' +
          '<text x="240" y="92" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-size="58" font-weight="330" fill="#1D1915">16:20</text>' +
          bars + '<text x="40" y="172" font-family="Instrument Sans, sans-serif" font-size="13" fill="#5E564C">Set Intentions · Focus Block · Break · Focus Block · Wrap Up</text></svg>';
      }
    },
    {
      title: 'Make it yours',
      body: 'Double-click the time or the title to change them. Open Edit session (E) to reorder segments, choose chimes, and give any segment a theme of its own.',
      art: () => {
        const rows = [['Set Intentions', '3:00', SP[0]], ['Focus Block', '25:00', SP[2]], ['Break', '5:00', SP[4]]];
        let y = 40;
        let out = '';
        rows.forEach((r, i) => {
          out += '<rect x="70" y="' + y + '" width="340" height="40" rx="12" fill="' + (i === 1 ? '#FFFFFF' : '#FBF7F0') + '" stroke="' + (i === 1 ? r[2] : '#E6DED1') + '"/>' +
            '<circle cx="92" cy="' + (y + 20) + '" r="6" fill="' + r[2] + '"/>' +
            '<text x="108" y="' + (y + 25) + '" font-family="Instrument Sans, sans-serif" font-size="14" font-weight="600" fill="#1D1915">' + r[0] + '</text>' +
            '<text x="392" y="' + (y + 25) + '" text-anchor="end" font-family="Instrument Sans, sans-serif" font-size="14" fill="#5E564C">' + r[1] + '</text>';
          y += 50;
        });
        return '<svg viewBox="0 0 480 210"><rect width="480" height="210" fill="#EFE7DA"/>' + out +
          '<g transform="translate(398 108) rotate(-8)"><rect x="-8" y="-3" width="56" height="26" rx="13" fill="#1D1915"/><text x="20" y="15" text-anchor="middle" font-family="Instrument Sans, sans-serif" font-size="12" font-weight="700" fill="#fff">Now</text></g></svg>';
      }
    },
    {
      title: 'Watch it grow',
      body: 'In the Growing Tree theme, each segment grows its own bonsai from dawn until the stars come out. Keep an eye out for visitors.',
      art: () =>
        '<svg viewBox="0 0 480 210" preserveAspectRatio="xMidYMid slice"><defs>' +
        '<linearGradient id="ig4sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5A7CC6"/><stop offset=".6" stop-color="#E6B47A"/><stop offset="1" stop-color="#FFD089"/></linearGradient>' +
        spectrumDefs('ig4') + '</defs>' +
        '<rect width="480" height="210" fill="url(#ig4sky)"/>' +
        '<circle cx="390" cy="92" r="26" fill="#FFC760"/><circle cx="390" cy="92" r="46" fill="#FFAE4E" opacity=".25"/>' +
        '<path d="M0 150 Q120 128 240 146 T480 140 V210 H0z" fill="#9E9A58"/>' +
        '<path d="M0 176 Q240 150 480 176 V210 H0z" fill="#8B9E47"/>' +
        '<rect x="186" y="168" width="108" height="8" rx="4" fill="#6688C4"/>' +
        '<path d="M190 176 H290 L282 198 H198z" fill="#3F5D98"/><rect x="196" y="183" width="88" height="3" fill="url(#ig4)"/>' +
        '<path d="M240 170 C236 150 220 142 226 124 C232 108 252 104 248 86" fill="none" stroke="#7A5234" stroke-width="9" stroke-linecap="round"/>' +
        '<path d="M228 132 C212 130 196 132 184 124" fill="none" stroke="#7A5234" stroke-width="5" stroke-linecap="round"/>' +
        '<path d="M244 104 C258 102 274 104 286 96" fill="none" stroke="#7A5234" stroke-width="4" stroke-linecap="round"/>' +
        '<g fill="#3E6E2D"><circle cx="176" cy="122" r="14"/><circle cx="194" cy="116" r="16"/><circle cx="288" cy="94" r="13"/><circle cx="272" cy="90" r="14"/><circle cx="236" cy="78" r="17"/><circle cx="256" cy="74" r="18"/></g>' +
        '<g fill="#C9C85A"><circle cx="192" cy="110" r="8"/><circle cx="274" cy="85" r="7"/><circle cx="250" cy="66" r="9"/></g>' +
        '<g fill="#F7B4CC"><circle cx="182" cy="112" r="3.4"/><circle cx="262" cy="70" r="3.4"/><circle cx="240" cy="72" r="3"/><circle cx="286" cy="88" r="3"/></g>' +
        '<g transform="translate(300 74)"><ellipse rx="10" ry="7.5" fill="#3A6FD0"/><circle cx="7" cy="-6" r="5" fill="#3A6FD0"/><ellipse cx="2" cy="2.5" rx="6" ry="4" fill="#F6B98A"/><path d="M11 -6 l5 1.5 -5 1.5z" fill="#F2A33A"/><circle cx="8.5" cy="-7" r="1.4" fill="#1A1A22"/></g>' +
        '</svg>'
    }
  ];

  let index = 0;

  function show(i) {
    index = i;
    const s = SLIDES[i];
    art.innerHTML = s.art();
    heading.textContent = s.title;
    text.textContent = s.body;
    nextBtn.textContent = i === SLIDES.length - 1 ? 'Get started' : 'Next';
    U.$$('span', dots).forEach((d, k) => d.classList.toggle('is-on', k === i));
  }

  ui.openIntro = () => {
    dots.innerHTML = SLIDES.map(() => '<span></span>').join('');
    show(0);
    if (!dlg.open) dlg.showModal();
    nextBtn.focus();
  };

  ui.openHelp = () => {
    const help = U.$('#helpDlg');
    if (!help.open) help.showModal();
  };

  ui.initIntro = () => {
    nextBtn.addEventListener('click', () => {
      if (index < SLIDES.length - 1) show(index + 1);
      else dlg.close('done');
    });
    skipBtn.addEventListener('click', () => dlg.close('skip'));
    dlg.addEventListener('close', () => S.flags.setOnboarded());
    dlg.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' && index < SLIDES.length - 1) show(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) show(index - 1);
    });
    U.$('#helpBtn').addEventListener('click', ui.openHelp);
    U.$('#replayIntroBtn').addEventListener('click', () => {
      U.$('#helpDlg').close();
      ui.openIntro();
    });
  };
})(window.JP = window.JP || {});
