/* Forest App landing page. Plain JS, no libraries, no inline code (the server's CSP blocks inline scripts). */
(function () {
  'use strict';

  // Must match the app + backend launch-offer cutoff: 10 Oct 2026 00:00 India time (= 9 Oct 18:30 UTC).
  // To extend the offer, change this one date (and the backend/app dates). After it passes,
  // everything marked data-offer disappears by itself.
  var OFFER_ENDS_AT = Date.parse('2026-10-09T18:30:00Z');

  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function hex(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function mix(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }
  function rgb(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a === undefined ? 1 : a) + ')'; }
  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  /* ================= living forest ================= */
  function Forest(canvas) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    var W = 0, H = 0, dpr = 1, layers = [], flies = [], leaves = [], mists = [], stars = [];
    var progress = 0, scrollY = 0, mx = 0, my = 0, tmx = 0, tmy = 0, mouseX = -999, mouseY = -999, t0 = 0;
    var small = Math.min(window.innerWidth, window.innerHeight) < 700;

    // Sky keyframes (kept dark enough for white text): dawn -> day -> dusk -> night
    var KEYS = [
      { p: 0.00, top: hex('#0b2530'), bot: hex('#d38a55'), sun: hex('#ffd9a0') },
      { p: 0.32, top: hex('#0d3a3a'), bot: hex('#3f9470'), sun: hex('#fff3c4') },
      { p: 0.66, top: hex('#1b1642'), bot: hex('#b65a42'), sun: hex('#ffb070') },
      { p: 1.00, top: hex('#030a12'), bot: hex('#0b2c24'), sun: hex('#dfe9ff') }
    ];
    function sky(p) {
      for (var i = 0; i < KEYS.length - 1; i++) {
        var a = KEYS[i], b = KEYS[i + 1];
        if (p <= b.p) {
          var t = smooth(a.p, b.p, p);
          return { top: mix(a.top, b.top, t), bot: mix(a.bot, b.bot, t), sun: mix(a.sun, b.sun, t) };
        }
      }
      var l = KEYS[KEYS.length - 1];
      return { top: l.top, bot: l.bot, sun: l.sun };
    }

    var LAYER_DEFS = [
      { col: '#1c4a39', hMin: 0.20, hMax: 0.34, n: 16, par: 0.018, sway: 3, fog: 0.50, y: 0.00 },
      { col: '#143c2d', hMin: 0.22, hMax: 0.40, n: 13, par: 0.034, sway: 4, fog: 0.38, y: 0.02 },
      { col: '#0d2e21', hMin: 0.26, hMax: 0.46, n: 10, par: 0.058, sway: 5, fog: 0.24, y: 0.04 },
      { col: '#06170f', hMin: 0.34, hMax: 0.60, n: 6, par: 0.095, sway: 7, fog: 0.00, y: 0.07 }
    ];

    function pine(c, x, base, h, w, r, col) {
      c.fillStyle = col;
      var tiers = 5 + ((r() * 3) | 0);
      var trunkH = h * 0.1;
      c.fillRect(x - w * 0.045, base - trunkH, w * 0.09, trunkH + 2);
      var top = base - h;
      c.beginPath();
      c.moveTo(x, top);
      var i, ty, tw;
      for (i = 1; i <= tiers; i++) {
        ty = top + (h - trunkH) * (i / tiers);
        tw = (w / 2) * (0.28 + 0.72 * (i / tiers));
        c.lineTo(x + tw, ty);
        c.lineTo(x + tw * 0.55, ty - (h / tiers) * 0.12);
      }
      for (i = tiers; i >= 1; i--) {
        ty = top + (h - trunkH) * (i / tiers);
        tw = (w / 2) * (0.28 + 0.72 * (i / tiers));
        c.lineTo(x - tw * 0.55, ty - (h / tiers) * 0.12);
        c.lineTo(x - tw, ty);
      }
      c.closePath();
      c.fill();
    }

    function build() {
      var rect = canvas.getBoundingClientRect();
      W = Math.max(320, Math.round(rect.width));
      H = Math.max(320, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      layers = LAYER_DEFS.map(function (d, li) {
        var lw = Math.round(W * 1.35), lh = Math.round(H * (d.hMax + 0.05));
        var off = document.createElement('canvas');
        off.width = Math.round(lw * dpr); off.height = Math.round(lh * dpr);
        var c = off.getContext('2d');
        if (!c) return null;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        var r = rng(917 + li * 131);
        var n = Math.round(d.n * (lw / W) * (small ? 0.75 : 1));
        // ground band so tree trunks never float
        c.fillStyle = d.col;
        c.beginPath();
        c.moveTo(0, lh);
        for (var gx = 0; gx <= lw; gx += lw / 12) c.lineTo(gx, lh - 8 - r() * 12 * (li + 1));
        c.lineTo(lw, lh);
        c.closePath(); c.fill();
        for (var i = 0; i < n; i++) {
          var x = (i + r() * 0.8) * (lw / n);
          var h = H * (d.hMin + r() * (d.hMax - d.hMin));
          var w = h * (0.34 + r() * 0.16);
          pine(c, x, lh - 4, h, w, r, d.col);
        }
        return { cv: off, w: lw, h: lh, def: d, phase: r() * 6.28 };
      }).filter(Boolean);

      var nf = small ? 16 : 34;
      flies = [];
      for (var f = 0; f < nf; f++) flies.push({ x: Math.random() * W, y: H * (0.35 + Math.random() * 0.6), vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .18, ph: Math.random() * 6.28, sp: .6 + Math.random() * 1.2, r: 1.2 + Math.random() * 2.2 });
      var nl = small ? 6 : 11, lc = ['#d0a85c', '#7fd1a0', '#3e9a66', '#e0b86a', '#a8d98c'];
      leaves = [];
      for (var l = 0; l < nl; l++) leaves.push(newLeaf(lc[l % lc.length], true));
      mists = [];
      for (var m = 0; m < 5; m++) mists.push({ x: Math.random() * W, y: H * (0.58 + Math.random() * 0.3), r: H * (0.22 + Math.random() * 0.2), v: (0.08 + Math.random() * 0.14) * (Math.random() < .5 ? -1 : 1) });
      stars = [];
      for (var s = 0; s < (small ? 60 : 120); s++) stars.push({ x: Math.random() * W, y: Math.random() * H * 0.55, r: Math.random() * 1.3 + .3, ph: Math.random() * 6.28 });
    }

    function newLeaf(col, anywhere) {
      return { x: Math.random() * W, y: anywhere ? Math.random() * H : -20, s: 6 + Math.random() * 8, rot: Math.random() * 6.28, vr: (Math.random() - .5) * .03, vy: .25 + Math.random() * .45, drift: Math.random() * 6.28, amp: 18 + Math.random() * 30, col: col || '#d0a85c' };
    }

    function drawLeaf(L) {
      ctx.save();
      ctx.translate(L.x, L.y);
      ctx.rotate(L.rot);
      ctx.fillStyle = L.col;
      ctx.globalAlpha = 0.78;
      ctx.beginPath();
      ctx.moveTo(0, -L.s);
      ctx.quadraticCurveTo(L.s * 0.8, -L.s * 0.2, 0, L.s);
      ctx.quadraticCurveTo(-L.s * 0.8, -L.s * 0.2, 0, -L.s);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(0, -L.s); ctx.lineTo(0, L.s); ctx.stroke();
      ctx.restore();
    }

    function draw(now) {
      var t = (now - t0) / 1000;
      mx += (tmx - mx) * 0.06; my += (tmy - my) * 0.06;
      var S = sky(progress);
      var night = smooth(0.62, 0.92, progress);
      var day = 1 - night;

      // sky
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgb(S.top)); g.addColorStop(1, rgb(S.bot));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // stars
      if (night > 0.02) {
        ctx.fillStyle = '#fff';
        for (var i = 0; i < stars.length; i++) {
          var st = stars[i];
          ctx.globalAlpha = night * (0.35 + 0.65 * Math.abs(Math.sin(t * 0.8 + st.ph)));
          ctx.beginPath(); ctx.arc(st.x - mx * 8, st.y, st.r, 0, 6.283); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // sun -> moon
      var q = clamp(progress / 0.98, 0, 1);
      var sx = W * (0.14 + 0.72 * q) - mx * 26, sy = H * (0.52 - Math.sin(q * Math.PI) * 0.34) - my * 12;
      var gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.42);
      gr.addColorStop(0, rgb(S.sun, 0.55)); gr.addColorStop(0.25, rgb(S.sun, 0.16)); gr.addColorStop(1, rgb(S.sun, 0));
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = rgb(S.sun, 0.95);
      ctx.beginPath(); ctx.arc(sx, sy, small ? 22 : 30, 0, 6.283); ctx.fill();
      if (night > 0.4) { ctx.fillStyle = rgb(S.top, 0.55 * night); ctx.beginPath(); ctx.arc(sx + 9, sy - 4, small ? 19 : 26, 0, 6.283); ctx.fill(); }

      // god rays (day / dawn / dusk)
      var rayA = 0.07 * day;
      if (rayA > 0.004) {
        for (var k = 0; k < 4; k++) {
          var ang = 1.18 + k * 0.17 + Math.sin(t * 0.3 + k) * 0.03;
          var rg = ctx.createLinearGradient(sx, sy, sx + Math.cos(ang) * H, sy + Math.sin(ang) * H);
          rg.addColorStop(0, rgb(S.sun, rayA)); rg.addColorStop(1, rgb(S.sun, 0));
          ctx.fillStyle = rg;
          ctx.beginPath(); ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(ang - 0.05) * H * 1.2, sy + Math.sin(ang - 0.05) * H * 1.2);
          ctx.lineTo(sx + Math.cos(ang + 0.05) * H * 1.2, sy + Math.sin(ang + 0.05) * H * 1.2);
          ctx.closePath(); ctx.fill();
        }
      }

      // tree layers with fog between them
      var sink = progress * H * 0.05;
      for (var li = 0; li < layers.length; li++) {
        var L = layers[li], d = L.def;
        var ox = -(L.w - W) / 2 + Math.sin(t * 0.35 + L.phase) * d.sway - mx * d.par * W * 1.6 - (progress - 0.5) * d.par * W * 2;
        var oy = H - L.h + d.y * H + sink * (li + 1) / layers.length + my * d.par * 60;
        ctx.drawImage(L.cv, ox, oy, L.w, L.h);
        if (d.fog > 0) {
          var fg = ctx.createLinearGradient(0, oy, 0, H);
          fg.addColorStop(0, rgb(S.bot, 0)); fg.addColorStop(1, rgb(S.bot, d.fog));
          ctx.fillStyle = fg; ctx.fillRect(0, oy, W, H - oy);
        }
        if (li === 1 || li === 2) drawMist(t, li === 1 ? 0.5 : 1, S);
      }

      // fireflies
      var fa = 0.22 + 0.78 * night;
      for (var f = 0; f < flies.length; f++) {
        var fl = flies[f];
        fl.x += fl.vx + Math.sin(t * fl.sp + fl.ph) * 0.18;
        fl.y += fl.vy + Math.cos(t * fl.sp * 0.8 + fl.ph) * 0.14;
        var dx = mouseX - fl.x, dy = mouseY - fl.y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 170 && dist > 1) { fl.x += dx / dist * 0.45; fl.y += dy / dist * 0.45; }
        if (fl.x < -20) fl.x = W + 20; if (fl.x > W + 20) fl.x = -20;
        if (fl.y < H * 0.25) fl.vy = Math.abs(fl.vy); if (fl.y > H + 10) fl.vy = -Math.abs(fl.vy);
        var pulse = 0.35 + 0.65 * Math.abs(Math.sin(t * fl.sp * 1.3 + fl.ph));
        var a = fa * pulse, rr = fl.r * (3.6 + pulse * 2.4);
        var fg2 = ctx.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, rr);
        fg2.addColorStop(0, 'rgba(226,255,140,' + a + ')'); fg2.addColorStop(0.4, 'rgba(190,255,120,' + (a * 0.35) + ')'); fg2.addColorStop(1, 'rgba(190,255,120,0)');
        ctx.fillStyle = fg2; ctx.beginPath(); ctx.arc(fl.x, fl.y, rr, 0, 6.283); ctx.fill();
      }

      // falling leaves
      for (var n = 0; n < leaves.length; n++) {
        var lf = leaves[n];
        lf.y += lf.vy; lf.drift += 0.018; lf.rot += lf.vr;
        lf.x += Math.sin(lf.drift) * 0.7 + 0.12 - mx * 0.2;
        if (lf.y > H + 20 || lf.x > W + 40 || lf.x < -40) { leaves[n] = newLeaf(lf.col, false); continue; }
        drawLeaf(lf);
      }
      ctx.globalAlpha = 1;

      // readability veil: light over the hero, stronger further down the page
      var veil = 0.10 + 0.30 * smooth(0, H * 0.7, scrollY);
      var vg = ctx.createLinearGradient(0, 0, 0, H);
      vg.addColorStop(0, 'rgba(2,9,6,' + (veil + 0.1) + ')'); vg.addColorStop(1, 'rgba(2,9,6,' + veil + ')');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }

    function drawMist(t, k, S) {
      for (var i = 0; i < mists.length; i++) {
        var m = mists[i];
        m.x += m.v * k;
        if (m.x > W + m.r) m.x = -m.r; if (m.x < -m.r) m.x = W + m.r;
        var g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
        g.addColorStop(0, rgb(mix(S.bot, [255, 255, 255], 0.45), 0.10 * k));
        g.addColorStop(1, rgb(S.bot, 0));
        ctx.fillStyle = g; ctx.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
      }
    }

    var raf = 0, running = false;
    function frame(now) {
      if (!running) return;
      draw(now);
      raf = requestAnimationFrame(frame);
    }
    function start() { if (running || reduce) return; running = true; t0 = t0 || performance.now(); raf = requestAnimationFrame(frame); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    build();
    t0 = performance.now();
    draw(t0 + 1); // always paint one frame (also the static frame for reduced motion)

    return {
      start: start, stop: stop,
      resize: function () { small = Math.min(window.innerWidth, window.innerHeight) < 700; build(); draw(performance.now()); },
      setScroll: function (p, y) { progress = p; scrollY = y; if (!running) draw(performance.now()); },
      setMouse: function (x, y, w, h) { tmx = x / w - 0.5; tmy = y / h - 0.5; mouseX = x; mouseY = y; },
      leave: function () { tmx = 0; tmy = 0; mouseX = -999; mouseY = -999; }
    };
  }

  /* ================= page behaviour ================= */
  function init() {
    // --- forest
    var canvas = $('#forest');
    var forest = canvas ? Forest(canvas) : null;
    var lastW = window.innerWidth;
    function onScroll() {
      var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      var y = window.pageYOffset || 0;
      if (forest) forest.setScroll(clamp(y / max, 0, 1), y);
      var nav = $('.nav'); if (nav) nav.classList.toggle('scrolled', y > 24);
      var dock = $('.dock'); var hero = $('.hero');
      if (dock && hero) dock.classList.toggle('show', y > hero.offsetHeight * 0.7);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    if (forest) {
      forest.start();
      var rt;
      window.addEventListener('resize', function () {
        clearTimeout(rt);
        rt = setTimeout(function () {
          // phones fire resize when the address bar hides; only rebuild on real width changes
          if (Math.abs(window.innerWidth - lastW) > 40) { lastW = window.innerWidth; forest.resize(); }
        }, 220);
      });
      if (!coarse) {
        window.addEventListener('mousemove', function (e) { forest.setMouse(e.clientX, e.clientY, window.innerWidth, window.innerHeight); }, { passive: true });
        document.addEventListener('mouseleave', forest.leave);
      }
      document.addEventListener('visibilitychange', function () { if (document.hidden) forest.stop(); else forest.start(); });
    }

    // --- mobile menu
    var burger = $('.burger'), links = $('.nav-links');
    if (burger && links) {
      burger.addEventListener('click', function () {
        var open = links.classList.toggle('open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      $$('a', links).forEach(function (a) { a.addEventListener('click', function () { links.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }); });
    }

    // --- reveal on scroll
    var rv = $$('.rv');
    if ('IntersectionObserver' in window && !reduce) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      rv.forEach(function (el, i) {
        el.style.setProperty('--d', ((i % 4) * 0.08) + 's');
        io.observe(el);
      });
    } else rv.forEach(function (el) { el.classList.add('in'); });

    // --- count-up numbers
    var counters = $$('[data-count]');
    function runCount(el) {
      var to = parseFloat(el.getAttribute('data-count')), suf = el.getAttribute('data-suffix') || '', dur = 1400, t0 = performance.now();
      if (reduce) { el.textContent = to + suf; return; }
      (function step(n) {
        var p = clamp((n - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(to * e) + suf;
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }
    if ('IntersectionObserver' in window) {
      var io2 = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { runCount(e.target); io2.unobserve(e.target); } });
      }, { threshold: 0.6 });
      counters.forEach(function (c) { io2.observe(c); });
    } else counters.forEach(function (c) { c.textContent = c.getAttribute('data-count') + (c.getAttribute('data-suffix') || ''); });

    // --- card spotlight + phone tilt
    if (!coarse) {
      $$('.card').forEach(function (c) {
        c.addEventListener('mousemove', function (e) {
          var r = c.getBoundingClientRect();
          c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
          c.style.setProperty('--my', (e.clientY - r.top) + 'px');
        });
      });
      $$('.stage').forEach(function (st) {
        var ph = $('.phone', st); if (!ph) return;
        var base = ph.style.transform;
        st.addEventListener('mousemove', function (e) {
          var r = st.getBoundingClientRect();
          var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
          ph.style.transform = 'rotateY(' + (x * 22 - 6) + 'deg) rotateX(' + (4 - y * 14) + 'deg) rotateZ(1deg)';
        });
        st.addEventListener('mouseleave', function () { ph.style.transform = base; });
      });
    }

    // --- showcase tabs (auto-rotating, pauses when touched)
    var demo = $('.demo');
    if (demo) {
      var tabs = $$('.tab', demo), screens = $$('.screen', demo), cur = 0, timer = 0, DUR = 6500;
      var show = function (i) {
        cur = i;
        tabs.forEach(function (t, k) { t.classList.toggle('on', k === i); t.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
        screens.forEach(function (s, k) { s.classList.toggle('active', k === i); });
        // restart the progress bar animation
        var bar = $('.bar', tabs[i]); if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
      };
      var auto = function () { clearInterval(timer); if (reduce || demo.classList.contains('paused')) return; timer = setInterval(function () { show((cur + 1) % tabs.length); }, DUR); };
      demo.style.setProperty('--dur', (DUR / 1000) + 's');
      tabs.forEach(function (t, i) {
        t.addEventListener('click', function () { demo.classList.add('paused'); clearInterval(timer); show(i); });
      });
      show(0); auto();
    }

    // --- launch offer countdown (and auto-removal after the cutoff)
    var offerEls = $$('[data-offer]');
    function tick() {
      var left = OFFER_ENDS_AT - Date.now();
      if (left <= 0) { offerEls.forEach(function (e) { e.classList.add('offer-off'); }); return false; }
      var d = Math.floor(left / 864e5), h = Math.floor(left % 864e5 / 36e5), m = Math.floor(left % 36e5 / 6e4), s = Math.floor(left % 6e4 / 1e3);
      function pad(n) { return n < 10 ? '0' + n : '' + n; }
      $$('[data-cd="d"]').forEach(function (e) { e.textContent = pad(d); });
      $$('[data-cd="h"]').forEach(function (e) { e.textContent = pad(h); });
      $$('[data-cd="m"]').forEach(function (e) { e.textContent = pad(m); });
      $$('[data-cd="s"]').forEach(function (e) { e.textContent = pad(s); });
      $$('[data-cd="short"]').forEach(function (e) { e.textContent = d > 0 ? d + 'd ' + pad(h) + 'h left' : pad(h) + ':' + pad(m) + ':' + pad(s); });
      return true;
    }
    if (offerEls.length && tick()) {
      var ct = setInterval(function () { if (!tick()) clearInterval(ct); }, 1000);
    }

    // --- footer year
    $$('[data-year]').forEach(function (e) { e.textContent = new Date().getFullYear(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
