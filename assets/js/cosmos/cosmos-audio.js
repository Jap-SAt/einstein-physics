/* ════════════════ cosmos-audio: เสียงประกอบที่สร้างสดด้วย Web Audio ════════════════
   No audio files. Layers: sub drone · detuned pad chord (changes per era) · filtered "space wind"
   · high shimmer notes · quark-era crackle · impacts. Everything continuous follows cosmic time t,
   so scrubbing the timeline re-voices the score; impacts fire only during forward playback.

   CosmosAudio.prime()  – call inside a user gesture (Safari/iOS unlock); creates/resumes one shared context
   CosmosAudio.create() – engine: start · update(t, eraId, playing, collisions) · impact(kind)
                          · setMuted · isMuted · isSuspended · resumeFromGesture · dispose */
const CosmosAudio = (() => {
  'use strict';

  const STORE_KEY = 'einstein_cosmos_muted';
  const LEVEL = 0.45;              // master gain when audible
  const RAMP_S = 3;                // fade-in on start
  const FADE_OUT_S = 0.6;          // fade-out on dispose
  const IMPACT_GAP_MS = 600;       // minimum time between impacts
  const SMOOTH = 0.25;             // setTargetAtTime constant for continuous params
  const PAUSED_DUCK = 0.3;         // non-drone layers while paused

  /* per-era voicing: root Hz, chord (semitones), pad low-pass cutoff, wind level, shimmer notes/s, drone level */
  const ERA_SOUND = {
    inflation:   { root: 55.00, chord: [0, 7, 14, 17], cutoff: 1800, wind: 0.50, shimmer: 3.0, drone: 0.7 },
    electroweak: { root: 55.00, chord: [0, 7, 12, 15], cutoff: 1400, wind: 0.45, shimmer: 2.0, drone: 0.6 },
    quark:       { root: 58.27, chord: [0, 3, 7, 10],  cutoff: 1100, wind: 0.35, shimmer: 1.5, drone: 0.6, crackle: true },
    nucleo:      { root: 61.74, chord: [0, 3, 7, 14],  cutoff: 900,  wind: 0.30, shimmer: 1.5, drone: 0.55 },
    radiation:   { root: 65.41, chord: [0, 5, 7, 12],  cutoff: 700,  wind: 0.50, shimmer: 0.8, drone: 0.5 },
    recomb:      { root: 49.00, chord: [0, 7, 10, 14], cutoff: 800,  wind: 0.25, shimmer: 2.5, drone: 0.6 },
    cosmicDawn:  { root: 43.65, chord: [0, 7, 9, 14],  cutoff: 1200, wind: 0.20, shimmer: 2.5, drone: 0.65 },
    solar:       { root: 51.91, chord: [0, 4, 7, 11],  cutoff: 1500, wind: 0.15, shimmer: 3.0, drone: 0.5 }
  };
  const PENTATONIC = [0, 2, 4, 7, 9, 12];

  let shared = null;

  function prime() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!shared || shared.state === 'closed') {
      try { shared = new AC(); } catch (e) { return null; }
    }
    if (shared.state === 'suspended') shared.resume().catch(() => {});
    return shared;
  }

  function readMuted() { try { return localStorage.getItem(STORE_KEY) === '1'; } catch (e) { return false; } }
  function writeMuted(m) { try { localStorage.setItem(STORE_KEY, m ? '1' : '0'); } catch (e) {} }

  function noiseBuffer(ctx, seconds) {
    const len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function impulseResponse(ctx, seconds) {                 // decaying stereo noise → large, soft hall
    const len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  /** Engine used when Web Audio is unavailable: same API, does nothing. */
  function silentEngine() {
    let muted = readMuted();
    return {
      start() {}, update() {}, impact() { return false; },
      setMuted(m) { muted = !!m; writeMuted(muted); }, isMuted: () => muted,
      isSuspended: () => false, resumeFromGesture: () => Promise.resolve(), dispose: () => Promise.resolve(),
      debug: { impactsPlayed: 0, contextState: () => 'unavailable', masterGain: () => 0 }
    };
  }

  function create() {
    const ctx = prime();
    if (!ctx) return silentEngine();
    const sources = [];
    let muted = readMuted(), started = false, disposed = false, eraId = null, playing = false, lastImpact = -Infinity;

    /* master chain: layers → (dry | reverb) → compressor → master → speakers */
    const master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.3;
    comp.connect(master); master.connect(ctx.destination);
    const dry = ctx.createGain(); dry.gain.value = 0.8; dry.connect(comp);
    const reverb = ctx.createConvolver(); reverb.buffer = impulseResponse(ctx, 3.5);
    const wet = ctx.createGain(); wet.gain.value = 0.45; reverb.connect(wet); wet.connect(comp);
    const toMix = (node, reverbAmount = 1) => {
      node.connect(dry);
      if (reverbAmount > 0) { const s = ctx.createGain(); s.gain.value = reverbAmount; node.connect(s); s.connect(reverb); }
    };
    const startSource = src => { src.start(); sources.push(src); return src; };
    const oscillator = (type, freq, detune = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune; return o; };

    /* 1 · sub drone */
    const drone = ctx.createGain(); drone.gain.value = 0; drone.connect(dry);
    const droneOsc = [oscillator('sine', 41.2), oscillator('sine', 41.2 * 1.003)];
    droneOsc.forEach(o => { const g = ctx.createGain(); g.gain.value = 0.5; o.connect(g); g.connect(drone); startSource(o); });

    /* 2 · pad: 4 voices × 2 detuned saws through one low-pass */
    const padFilter = ctx.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 900; padFilter.Q.value = 0.7;
    const pad = ctx.createGain(); pad.gain.value = 0; padFilter.connect(pad); toMix(pad, 1);
    const voices = [0, 1, 2, 3].map(() => {
      const g = ctx.createGain(); g.gain.value = 0.05; g.connect(padFilter);
      const pair = [oscillator('sawtooth', 110, -7), oscillator('sawtooth', 110, 7)];
      pair.forEach(o => { o.connect(g); startSource(o); });
      return pair;
    });

    /* 3 · space wind: looping noise through a moving band-pass */
    const noise = noiseBuffer(ctx, 2);
    const windSrc = ctx.createBufferSource(); windSrc.buffer = noise; windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 800; windFilter.Q.value = 1.2;
    const wind = ctx.createGain(); wind.gain.value = 0;
    windSrc.connect(windFilter); windFilter.connect(wind); toMix(wind, 0.6); startSource(windSrc);

    /* 4/5 · shimmer notes and quark crackle are scheduled one-shots into these buses */
    const shimmerBus = ctx.createGain(); shimmerBus.gain.value = 0.9; toMix(shimmerBus, 1.4);
    const crackleBus = ctx.createGain(); crackleBus.gain.value = 0.5; toMix(crackleBus, 0.3);

    const glide = (param, value) => param.setTargetAtTime(value, ctx.currentTime, SMOOTH);

    function voiceEra(id) {
      const s = ERA_SOUND[id] || ERA_SOUND.inflation;
      voices.forEach((pair, i) => {
        const f = s.root * 2 * Math.pow(2, s.chord[i % s.chord.length] / 12);
        pair.forEach(o => glide(o.frequency, f));
      });
      droneOsc[0].frequency.setTargetAtTime(s.root * 0.75, ctx.currentTime, 1.2);
      droneOsc[1].frequency.setTargetAtTime(s.root * 0.75 * 1.003, ctx.currentTime, 1.2);
    }

    function shimmerNote(s) {
      const now = ctx.currentTime, step = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
      const f = s.root * 16 * Math.pow(2, step / 12) * (Math.random() < 0.3 ? 2 : 1);
      const o = oscillator('sine', f), g = ctx.createGain();
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.05, now + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
      o.connect(g); g.connect(shimmerBus); o.start(now); o.stop(now + 2.5);
    }
    function crackle() {
      const now = ctx.currentTime, src = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noise; hp.type = 'highpass'; hp.frequency.value = 2500 + Math.random() * 3000;
      g.gain.setValueAtTime(0.25 * Math.random(), now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
      src.connect(hp); hp.connect(g); g.connect(crackleBus); src.start(now, Math.random() * 1.5, 0.04);
    }

    let lastUpdate = 0;
    function update(t, id, isPlaying, collisions) {
      if (disposed) return;
      const now = ctx.currentTime, dt = Math.min(0.1, Math.max(0, now - lastUpdate || 0));
      lastUpdate = now; playing = !!isPlaying;
      if (id !== eraId) { eraId = id; voiceEra(id); }
      const s = ERA_SOUND[id] || ERA_SOUND.inflation, duck = playing ? 1 : PAUSED_DUCK;
      glide(drone.gain, s.drone * 0.6);
      glide(pad.gain, 0.55 * duck);
      glide(padFilter.frequency, s.cutoff);
      glide(wind.gain, s.wind * 0.35 * duck);
      // expansion is fastest early (H ∝ 1/t): the wind band sweeps down as log t grows
      const logT = Math.log10(Math.max(t, 1e-43));
      glide(windFilter.frequency, Math.min(2400, Math.max(180, 2400 - (logT + 43) * 36)));
      if (!playing || !started) return;
      if (Math.random() < s.shimmer * dt) shimmerNote(s);
      if (s.crackle) { const rate = Math.min(40, (collisions || 0) * 0.5); if (Math.random() < rate * dt) crackle(); }
    }

    function impact(kind) {
      if (disposed || !playing) return false;
      const ms = performance.now();
      if (ms - lastImpact < IMPACT_GAP_MS) return false;
      lastImpact = ms; api.debug.impactsPlayed++;
      const now = ctx.currentTime, big = kind === 'bigbang', peak = big ? 0.9 : kind === 'cmb' ? 0.6 : 0.45;
      const boom = oscillator('sine', big ? 120 : 90), bg = ctx.createGain();
      boom.frequency.setValueAtTime(big ? 120 : 90, now); boom.frequency.exponentialRampToValueAtTime(32, now + (big ? 2.5 : 1.4));
      bg.gain.setValueAtTime(0, now); bg.gain.linearRampToValueAtTime(peak, now + 0.03); bg.gain.exponentialRampToValueAtTime(0.0001, now + (big ? 3.5 : 2));
      boom.connect(bg); toMix(bg, 0.7); boom.start(now); boom.stop(now + 3.6);
      const burst = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), ng = ctx.createGain();
      burst.buffer = noise; lp.type = 'lowpass'; lp.frequency.setValueAtTime(big ? 6000 : 2500, now); lp.frequency.exponentialRampToValueAtTime(200, now + 1.5);
      ng.gain.setValueAtTime(peak * 0.5, now); ng.gain.exponentialRampToValueAtTime(0.0001, now + (big ? 2.5 : 1.2));
      burst.connect(lp); lp.connect(ng); toMix(ng, 1); burst.start(now, 0, 2.6);
      return true;
    }

    function applyMaster(rampSeconds) {
      const now = ctx.currentTime, target = muted || !started ? 0 : LEVEL;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(target, now + rampSeconds);
    }

    const api = {
      start() { if (disposed || started) return; started = true; master.gain.setValueAtTime(0, ctx.currentTime); applyMaster(RAMP_S); },
      update, impact,
      setMuted(m) { muted = !!m; writeMuted(muted); if (!disposed) applyMaster(0.4); },
      isMuted: () => muted,
      isSuspended: () => ctx.state === 'suspended',
      resumeFromGesture: () => ctx.resume().catch(() => {}),
      dispose() {
        if (disposed) return Promise.resolve();
        disposed = true;
        if (shared === ctx) shared = null;                     // a session opened during the fade gets a fresh context
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now); master.gain.linearRampToValueAtTime(0, now + FADE_OUT_S);
        return new Promise(resolve => setTimeout(resolve, FADE_OUT_S * 1000 + 50)).then(() => {
          sources.forEach(src => { try { src.stop(); } catch (e) {} });
          return ctx.close().catch(() => {});
        });
      },
      debug: { impactsPlayed: 0, contextState: () => ctx.state, masterGain: () => master.gain.value }
    };
    return api;
  }

  return { prime, create };
})();
