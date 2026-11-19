/* ════════════════ Cosmos: กำเนิดจักรวาล (controller) ════════════════
   Ties CosmosPhysics (time, T, a), CosmosVisuals (scene), CosmosAudio (sound) and CosmosUI (dock/HUD).
   One session at a time. Everything visible is a function of the slider position u ∈ [0, 1].
   Public API: Cosmos.open([{ onClose }]), Cosmos.close(), Cosmos.isOpen(), Cosmos.primeAudio()
   Depends on globals: Theme (helpers.js), route() (app.js). */
const Cosmos = (() => {
  'use strict';
  const P = CosmosPhysics;
  const DT_MAX = 0.05;                     // a stalled tab must not leap through an era
  const CLOSE_FADE_MS = 450;
  const STAR_P = 0.05;                     // first-star ignition, as a fraction of cosmic dawn
  const PERF_WINDOW_S = 2, PERF_BUDGET_MS = 22;
  const NEXT_QUALITY = { high: 'medium', medium: 'low' };

  /* era start positions on the slider */
  const STARTS = [];
  P.ERAS.reduce((u, e) => { STARTS.push(u); return u + e.width; }, 0);
  const eraIndexAtU = u => { let i = 0; while (i < STARTS.length - 1 && u >= STARTS[i + 1]) i++; return i; };
  const DAWN = P.ERAS.findIndex(e => e.id === 'cosmicDawn');

  let S = null;                            // the open session, or null
  const dbg = { impacts: 0 };

  const prefersReducedMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const coarse = () => !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);

  function primeAudio() { if (typeof CosmosAudio !== 'undefined') CosmosAudio.prime(); }

  /* ── session lifecycle ── */
  function open(options = {}) {
    if (S) return;
    const s = {
      onClose: typeof options.onClose === 'function' ? options.onClose : () => { if (typeof route === 'function') route(true); },
      prevFocus: document.activeElement,
      prevOverflow: document.body.style.overflow,
      reducedMotion: prefersReducedMotion(),
      u: 0, playing: true, speed: 1, scrubbing: false, ended: false,
      raf: 0, last: 0, timers: new Set(), vis: null, engine: null,
      perf: { acc: 0, n: 0 }
    };
    S = s;
    s.ui = CosmosUI.create({
      onScrub: u => { if (S !== s) return; s.scrubbing = true; setU(s, u); },
      onScrubEnd: () => { if (S === s) s.scrubbing = false; },
      onPlayToggle: () => togglePlay(s),
      onSpeed: n => { if (S === s && [1, 2, 5].includes(n)) s.speed = n; },
      onToggleGrid: on => { if (S === s && s.vis) s.vis.setState({ showGrid: on }); },
      onToggleLabels: on => { if (S === s && s.vis) s.vis.setState({ showLabels: on }); },
      onToggleSound: () => toggleSound(s),
      onPrevEra: () => jumpEra(s, -1),
      onNextEra: () => jumpEra(s, +1),
      onClose: close
    });
    const root = s.ui.root;
    s.flash = el('div', 'cc-flash'); root.appendChild(s.flash);
    s.end = buildEnd(s); root.appendChild(s.end);
    document.body.appendChild(root);
    document.body.style.overflow = 'hidden';
    if (typeof Theme !== 'undefined') Theme.set('dark');   // after S is set: app.js ignores themechange while open

    try {
      s.vis = CosmosVisuals.create(s.ui.stage, {
        quality: coarse() ? 'medium' : 'high',
        reducedMotion: s.reducedMotion,
        onUserCamera() {}
      });
    } catch (err) {
      console.warn('Cosmos: WebGL is not available', err);
      showFailure(s);
      return;
    }
    try { s.engine = CosmosAudio.create(); s.engine.start(); } catch (err) { s.engine = null; }

    s.onKey = e => onKey(s, e);
    window.addEventListener('keydown', s.onKey);
    later(s, () => root.classList.add('on'), 16);
    focusFirst(s);
    s.eraIndex = 0;
    s.ui.showEra(P.ERAS[0]);
    if (s.engine) { s.engine.update(P.CONST.T_START, P.ERAS[0].id, true, 0); impact(s, 'bigbang'); }
    if (!s.reducedMotion) flash(s);
    s.last = performance.now();
    s.raf = requestAnimationFrame(loop);
  }

  function close() {
    const s = S;
    if (!s) return;
    S = null;
    cancelAnimationFrame(s.raf);
    s.timers.forEach(clearTimeout); s.timers.clear();
    if (s.onKey) window.removeEventListener('keydown', s.onKey);
    if (s.vis) { s.vis.dispose(); s.vis = null; }
    if (s.engine) { const e = s.engine; s.engine = null; e.dispose().catch(() => {}); }   // fade out in the background
    s.ui.root.classList.remove('on');
    setTimeout(() => s.ui.dispose(), CLOSE_FADE_MS);
    document.body.style.overflow = s.prevOverflow;
    if (s.prevFocus && typeof s.prevFocus.focus === 'function' && document.contains(s.prevFocus)) s.prevFocus.focus({ preventScroll: true });
    s.onClose();
  }

  /* ── helpers ── */
  function el(tag, cls, text) { const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function later(s, fn, ms) {
    const id = setTimeout(() => { s.timers.delete(id); if (S === s) fn(); }, ms);
    s.timers.add(id);
  }
  function focusFirst(s) {
    const b = s.ui.root.querySelector('.cc-play') || s.ui.root.querySelector('button');
    if (b) b.focus({ preventScroll: true });
  }
  function flash(s) {
    const f = s.flash;
    f.style.transition = 'none'; f.style.opacity = '1';
    void f.offsetWidth;
    f.style.transition = 'opacity 1.8s ease-out'; f.style.opacity = '0';
  }
  function buildEnd(s) {
    const box = el('div', 'cc-end');
    const again = el('button', 'cc-btn', 'เล่นอีกครั้ง'), back = el('button', 'cc-btn', 'กลับสู่บทเรียน');
    again.type = back.type = 'button';
    again.addEventListener('click', () => restart(s));
    back.addEventListener('click', close);
    box.append(again, back);
    return box;
  }
  function showFailure(s) {
    s.ui.root.classList.add('cc-failed', 'on');
    const box = el('div', 'cc-error');
    box.appendChild(el('p', '', 'อุปกรณ์หรือเบราว์เซอร์นี้เปิด WebGL ไม่ได้ จึงแสดงแอนิเมชันกำเนิดจักรวาลไม่ได้ ลองเปิดการเร่งกราฟิก (hardware acceleration) หรือใช้เบราว์เซอร์อื่น'));
    const b = el('button', 'cc-btn', 'ปิด'); b.type = 'button'; b.addEventListener('click', close);
    box.appendChild(b);
    s.ui.root.appendChild(box);
    s.onKey = e => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', s.onKey);
    b.focus({ preventScroll: true });
  }
  function impact(s, kind) {
    dbg.impacts++;
    if (s.engine) s.engine.impact(kind);
  }

  /* ── playback ── */
  function setU(s, u) {
    s.u = Math.min(1, Math.max(0, u));
    s.ended = s.u >= 1 && s.ended;
    syncEra(s);
  }
  function syncEra(s) {
    const i = eraIndexAtU(s.u);
    if (i !== s.eraIndex) {
      s.eraIndex = i;
      s.ui.showEra(P.ERAS[i]);
      if (s.vis) s.vis.resetCamera();                 // a dragged camera holds only until the next era
    }
    s.end.classList.toggle('on', s.ended);
  }
  function advance(s, dt) {
    if (!s.playing || s.scrubbing || s.ended) return;
    const i0 = eraIndexAtU(s.u), e = P.ERAS[i0];
    const before = s.u, starBefore = (before - STARTS[DAWN]) / P.ERAS[DAWN].width;
    s.u = Math.min(1, s.u + e.width / e.dur * dt * s.speed);
    const i1 = eraIndexAtU(s.u);
    for (let k = i0 + 1; k <= i1; k++) impact(s, P.ERAS[k].id === 'recomb' ? 'cmb' : 'era');
    const starAfter = (s.u - STARTS[DAWN]) / P.ERAS[DAWN].width;
    if (starBefore < STAR_P && starAfter >= STAR_P) impact(s, 'star');
    if (s.u >= 1) { s.ended = true; s.playing = false; }
    syncEra(s);
  }
  function togglePlay(s) {
    if (S !== s) return;
    if (s.ended) { restart(s); return; }
    s.playing = !s.playing;
  }
  function restart(s) {
    if (S !== s) return;
    s.ended = false; s.playing = true; s.scrubbing = false;
    setU(s, 0);
    impact(s, 'bigbang');
    if (!s.reducedMotion) flash(s);
    focusFirst(s);
  }
  function jumpEra(s, dir) {
    if (S !== s) return;
    const i = eraIndexAtU(s.u);
    let target;
    if (dir < 0) target = s.u - STARTS[i] > P.ERAS[i].width * 0.02 ? STARTS[i] : STARTS[Math.max(0, i - 1)];
    else target = i + 1 < STARTS.length ? STARTS[i + 1] : 1;
    s.ended = target >= 1;
    if (s.ended) s.playing = false;
    setU(s, target);
  }
  function toggleSound(s) {
    if (S !== s || !s.engine) return;
    if (s.engine.isSuspended() && !s.engine.isMuted()) s.engine.resumeFromGesture();
    else s.engine.setMuted(!s.engine.isMuted());
  }

  function onKey(s, e) {
    if (S !== s || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target && e.target.tagName;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === ' ' || e.code === 'Space') {
      if (tag === 'BUTTON' || tag === 'INPUT') return;    // the focused control handles its own Space
      e.preventDefault();
      if (!e.repeat) togglePlay(s);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (tag === 'INPUT') return;                         // the slider moves itself
      e.preventDefault();
      jumpEra(s, e.key === 'ArrowLeft' ? -1 : 1);
    }
  }

  /* ── frame ── */
  function frame(s, dtIn) {
    const dt = Math.min(DT_MAX, Math.max(0, dtIn));
    advance(s, dt);
    const t = P.sliderToTime(s.u), era = P.ERAS[s.eraIndex];
    s.vis.setState({ t });
    s.vis.render(dt);
    if (s.engine) s.engine.update(t, era.id, s.playing && !s.ended, s.vis.strongPairs());
    s.ui.update({
      t, u: s.u, tempK: P.temperature(t), tempApprox: P.isTemperatureApprox(t), scale: P.scaleFactor(t),
      playing: s.playing && !s.ended, speed: s.speed,
      muted: s.engine ? s.engine.isMuted() : true, soundSuspended: s.engine ? s.engine.isSuspended() : false,
      eraIndex: s.eraIndex
    });
    s.ui.setLabels(s.vis.labelAnchors());
  }
  function monitor(s, dtRaw) {
    if (dtRaw <= 0 || dtRaw > 0.5) return;               // ignore tab switches
    s.perf.acc += dtRaw; s.perf.n++;
    if (s.perf.acc < PERF_WINDOW_S) return;
    const avgMs = s.perf.acc / s.perf.n * 1000;
    s.perf.acc = 0; s.perf.n = 0;
    const next = NEXT_QUALITY[s.vis.quality];
    if (avgMs > PERF_BUDGET_MS && next) s.vis.setQuality(next);
  }
  function loop(now) {
    const s = S;
    if (!s || !s.vis) return;
    const dtRaw = (now - s.last) / 1000;
    s.last = now;
    monitor(s, dtRaw);
    frame(s, dtRaw);
    s.raf = requestAnimationFrame(loop);
  }

  return {
    open, close, primeAudio,
    isOpen: () => S !== null,
    debug: {
      state: () => (S ? { t: P.sliderToTime(S.u), u: S.u, eraId: P.ERAS[eraIndexAtU(S.u)].id, playing: S.playing && !S.ended, speed: S.speed, quality: S.vis ? S.vis.quality : null } : null),
      frame: dt => { if (S && S.vis) frame(S, dt); },
      impacts: () => dbg.impacts,
      audioState: () => (S && S.engine ? S.engine.debug.contextState() : 'none'),
      get vis() { return S ? S.vis : null; }
    }
  };
})();
