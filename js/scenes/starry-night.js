/* ═══════════════════════════════════════════════════════════════
   JoyPro Timer Reloaded · scenes/starry-night.js
   Starry Night, ported from the original app as it was: the same
   indigo sky, star density, twinkle and fireball shooting stars
   every 30–60 seconds. (Adam: only the Growing Tree gets reworked.)
   The one change is crisp rendering on high-density screens.
   ═══════════════════════════════════════════════════════════════ */
(function (JP) {
  'use strict';

  JP.scenes.register('starryNight', function (canvas) {
    const ctx = canvas.getContext('2d');
    let W = 0;
    let H = 0;
    let dpr = 1;
    let stars = [];
    const shooting = [];
    let nextShootAt = 0;

    canvas.style.background = 'linear-gradient(180deg, #0b0e2a 0%, #1a1040 40%, #0d1137 100%)';

    function seedStars() {
      stars = [];
      const count = Math.floor((W * H) / 2400);
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * 1.5 + 0.3,
          baseAlpha: Math.random() * 0.6 + 0.3,
          twinkleSpeed: Math.random() * 0.008 + 0.003,
          twinkleOffset: Math.random() * Math.PI * 2
        });
      }
    }

    function scheduleShootingStar(now) {
      nextShootAt = now + 30 + Math.random() * 30; // 30–60 s, as before
    }

    function launch(now) {
      const x0 = Math.random() * W * 0.7;
      const y0 = Math.random() * H * 0.3;
      const angle = (Math.random() * 0.4 + 0.3) * Math.PI;
      const dist = Math.max(W, H) * (0.4 + Math.random() * 0.3);
      shooting.push({
        x0, y0,
        x1: x0 + Math.cos(angle - Math.PI / 4) * dist,
        y1: y0 + Math.sin(angle - Math.PI / 4) * dist,
        startTime: now,
        duration: 1.2 + Math.random() * 0.6,
        tailLength: 180 + Math.random() * 120
      });
    }

    function drawShootingStar(ss, now) {
      const progress = (now - ss.startTime) / ss.duration;
      if (progress > 1) return false;
      const x = ss.x0 + (ss.x1 - ss.x0) * progress;
      const y = ss.y0 + (ss.y1 - ss.y0) * progress;
      const fade = progress < 0.15 ? progress / 0.15 : progress > 0.7 ? (1 - progress) / 0.3 : 1;

      // Outer glow (large warm halo)
      const glowR = W < 480 ? 20 : 40;
      const outerGlow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      outerGlow.addColorStop(0, 'rgba(255, 200, 100, ' + 0.4 * fade + ')');
      outerGlow.addColorStop(0.3, 'rgba(255, 150, 50, ' + 0.15 * fade + ')');
      outerGlow.addColorStop(1, 'rgba(255, 100, 20, 0)');
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = outerGlow;
      ctx.fill();

      // Fireball head: white-hot core with an orange rim
      const head = ctx.createRadialGradient(x, y, 0, x, y, 16);
      head.addColorStop(0, 'rgba(255, 255, 255, ' + fade + ')');
      head.addColorStop(0.25, 'rgba(255, 240, 200, ' + 0.9 * fade + ')');
      head.addColorStop(0.5, 'rgba(255, 180, 60, ' + 0.7 * fade + ')');
      head.addColorStop(0.8, 'rgba(255, 100, 20, ' + 0.3 * fade + ')');
      head.addColorStop(1, 'rgba(255, 60, 10, 0)');
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fillStyle = head;
      ctx.fill();

      // Trail: a wide fiery streak with a bright core
      const tailLen = ss.tailLength * fade;
      const angle = Math.atan2(ss.y1 - ss.y0, ss.x1 - ss.x0);
      const tx = x - Math.cos(angle) * tailLen;
      const ty = y - Math.sin(angle) * tailLen;

      const outerTrail = ctx.createLinearGradient(x, y, tx, ty);
      outerTrail.addColorStop(0, 'rgba(255, 160, 40, ' + 0.5 * fade + ')');
      outerTrail.addColorStop(0.3, 'rgba(255, 100, 20, ' + 0.25 * fade + ')');
      outerTrail.addColorStop(1, 'rgba(255, 60, 10, 0)');
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = outerTrail;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.stroke();

      const innerTrail = ctx.createLinearGradient(x, y, tx, ty);
      innerTrail.addColorStop(0, 'rgba(255, 255, 220, ' + 0.8 * fade + ')');
      innerTrail.addColorStop(0.4, 'rgba(255, 200, 100, ' + 0.35 * fade + ')');
      innerTrail.addColorStop(1, 'rgba(255, 180, 60, 0)');
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = innerTrail;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.lineCap = 'butt';
      return true;
    }

    return {
      resize(w, h, ratio) {
        W = w;
        H = h;
        dpr = ratio;
        seedStars();
      },
      frame(now) {
        if (!nextShootAt) scheduleShootingStar(now);
        if (now >= nextShootAt) {
          launch(now);
          scheduleShootingStar(now);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        for (const s of stars) {
          const alpha = Math.max(0.05, Math.min(1, s.baseAlpha + Math.sin(now * s.twinkleSpeed * 60 + s.twinkleOffset) * 0.3));
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, ' + alpha + ')';
          ctx.fill();
        }
        for (let i = shooting.length - 1; i >= 0; i--) {
          if (!drawShootingStar(shooting[i], now)) shooting.splice(i, 1);
        }
      },
      destroy() {
        canvas.style.background = '';
      }
    };
  });
})(window.JP = window.JP || {});
