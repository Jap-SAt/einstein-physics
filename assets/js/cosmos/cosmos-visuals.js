/* ════════════════ cosmos-visuals: ภาพแบบภาพยนตร์ด้วย Three.js ════════════════
   Renderer → EffectComposer (RenderPass → UnrealBloom → grade pass: exposure/tint, ACES, vignette,
   film grain, slight chromatic aberration). Ambient particles live on the GPU: the vertex shader holds
   one layout per era and every position is a function of cosmic time, so scrubbing is deterministic.
   Era transitions blend over the first BLEND of each era's progress (also a function of t).

   CosmosVisuals.create(container, { quality, reducedMotion, onUserCamera }) → Vis */
const CosmosVisuals = (() => {
  'use strict';
  const P = CosmosPhysics;

  const TIERS = {
    high:   { ambient: 100000, bloomScale: 1,    dpr: 2,   aberration: true },
    medium: { ambient: 50000,  bloomScale: 0.5,  dpr: 1.5, aberration: true },
    low:    { ambient: 20000,  bloomScale: 0.25, dpr: 1,   aberration: false }
  };
  const MAX_AMBIENT = TIERS.high.ambient;
  const BLEND = 0.12;               // fraction of an era's progress used to morph from the previous era
  const GRAIN = 0.035, ABERRATION = 0.0016, VIGNETTE = 0.85, SHAKE = 0.15;
  const BACKGROUND = 0x05050a;

  /* camera keyframes per era: from → to across the era's progress */
  const CAMERA = {
    inflation:   { from: { pos: [0, 1.5, 9],  target: [0, 0, 0], fov: 45 }, to: { pos: [0, 3, 14],  target: [0, 0, 0], fov: 60 } },
    electroweak: { from: { pos: [0, 8, 62],   target: [0, 0, 0], fov: 55 }, to: { pos: [12, 9, 60], target: [0, 0, 0], fov: 55 } },
    quark:       { from: { pos: [0, 4, 40],   target: [0, 0, 0], fov: 55 }, to: { pos: [-6, 6, 26], target: [0, 0, 0], fov: 50 } },
    nucleo:      { from: { pos: [-6, 6, 28],  target: [0, 0, 0], fov: 50 }, to: { pos: [8, 5, 34],  target: [0, 0, 0], fov: 50 } },
    radiation:   { from: { pos: [8, 5, 34],   target: [0, 0, 0], fov: 50 }, to: { pos: [0, 6, 46],  target: [0, 0, 0], fov: 52 } },
    recomb:      { from: { pos: [0, 6, 46],   target: [0, 0, 0], fov: 52 }, to: { pos: [0, 12, 88], target: [0, 0, 0], fov: 55 } },
    cosmicDawn:  { from: { pos: [0, 18, 92],  target: [0, 0, 0], fov: 55 }, to: { pos: [34, 22, 62], target: [0, 0, 0], fov: 50 } },
    solar:       { from: { pos: [0, 14, 36],  target: [0, 0, 0], fov: 50 }, to: { pos: [9.5, 2.5, 10], target: [6, 0, 0], fov: 42 } }
  };

  /* ── shaders ── */
  const AMBIENT_VERT = `
    attribute vec4 aSeed; attribute vec4 aSeed2;
    uniform float uEraA, uEraB, uMix, uProgA, uProgB, uScaleA, uScaleB, uTime, uSize, uPixelRatio;
    varying vec3 vColor;
    vec3 dirOf(vec4 s) { float z = s.x * 2.0 - 1.0; float a = s.y * 6.2831853; float r = sqrt(max(0.0, 1.0 - z * z)); return vec3(r * cos(a), z, r * sin(a)); }
    vec3 hash3(float n) { return fract(sin(vec3(n, n + 1.7, n + 3.1)) * vec3(43758.5453, 22578.1459, 19642.3490)); }
    void eraLayout(float era, float p, float scl, out vec3 pos, out vec3 col, out float size) {
      vec3 d = dirOf(aSeed); float rr = pow(aSeed.z, 0.3333);
      if (era < 0.5) {                                   // Planck & inflation: the camera sits INSIDE the hot patch (no centre),
        float g = pow(smoothstep(0.6, 1.0, p), 2.5);     // then space itself stretches exponentially around it
        pos = d * rr * mix(14.0, 70.0, g);
        col = mix(vec3(1.0, 0.97, 0.9), vec3(0.75, 0.88, 1.0), g) * mix(0.045, 0.9, g); size = mix(0.6, 1.0, g);
      } else if (era < 1.5) {                            // hot era after reheating
        pos = d * rr * (70.0 + 10.0 * p) + 2.0 * vec3(sin(p * 6.0 + aSeed2.x * 20.0), sin(p * 5.0 + aSeed2.y * 20.0), sin(p * 7.0 + aSeed2.z * 20.0));
        col = vec3(1.0, 0.82, 0.55) * 0.5; size = 1.0;
      } else if (era < 2.5) {                            // quark–gluon plasma; confinement at ~1e-6 s (p ≈ 0.5)
        vec3 freeP = (aSeed2.xyz * 2.0 - 1.0) * 45.0 + 1.6 * vec3(sin(p * 90.0 + aSeed.w * 50.0), sin(p * 80.0 + aSeed.x * 50.0), sin(p * 100.0 + aSeed.y * 50.0));
        float gid = floor(aSeed2.w * 30000.0), member = mod(floor(aSeed.w * 3.0), 3.0);
        vec3 bound = (hash3(gid) * 2.0 - 1.0) * 45.0 + (hash3(gid * 3.0 + member) - 0.5) * 0.9;
        float conf = smoothstep(0.42, 0.58, p);
        pos = mix(freeP, bound, conf);
        vec3 qc = member < 0.5 ? vec3(1.0, 0.32, 0.25) : (member < 1.5 ? vec3(0.35, 1.0, 0.45) : vec3(0.35, 0.55, 1.0));
        col = mix(qc * 0.42 + vec3(0.12, 0.07, 0.02), vec3(1.0, 0.78, 0.5) * 0.45, conf); size = mix(0.7, 0.9, conf);
      } else if (era < 3.5) {                            // nucleosynthesis: nucleons settle into small nuclei
        float nid = floor(aSeed2.w * 9000.0);
        vec3 centre = (hash3(nid + 7.0) * 2.0 - 1.0) * 50.0 * (1.0 + 0.15 * p);
        pos = centre + (aSeed.xyz - 0.5) * mix(2.5, 0.7, p);
        col = vec3(1.0, 0.62, 0.3) * 0.8; size = 1.0;
      } else if (era < 4.5) {                            // radiation era: opaque glowing fog
        pos = (aSeed2.xyz * 2.0 - 1.0) * 70.0 + 1.5 * vec3(sin(p * 4.0 + aSeed.x * 30.0), sin(p * 5.0 + aSeed.y * 30.0), sin(p * 3.0 + aSeed.z * 30.0));
        col = vec3(1.0, 0.55, 0.28) * 0.45; size = 2.2;
      } else if (era < 5.5) {                            // recombination at p ≈ 0.07, then dark ages
        float fog = 1.0 - smoothstep(0.03, 0.12, p);
        if (aSeed2.w < 0.25) {                           // decoupled photons stream out and become the CMB
          float m = 0.35 + 0.65 * fract(sin(dot(floor(d * 9.0), vec3(12.9, 78.2, 37.7))) * 43758.5);
          pos = mix(d * rr * 60.0, d * 260.0, smoothstep(0.04, 0.2, p));
          col = vec3(0.9, 0.25, 0.08) * m * mix(1.0, 0.35, smoothstep(0.2, 1.0, p)); size = 1.6;
        } else {
          pos = (aSeed2.xyz * 2.0 - 1.0) * 70.0 * scl;
          col = mix(vec3(1.0, 0.55, 0.28) * 0.45, vec3(0.75, 0.8, 1.0) * mix(0.45, 0.16, p), 1.0 - fog); size = mix(2.2, 0.8, 1.0 - fog);
        }
      } else if (era < 6.5) {                            // cosmic web, first stars, galaxies (comoving × expansion)
        vec3 cell = floor(aSeed.xyz * 6.0);
        vec3 node = ((cell + hash3(dot(cell, vec3(1.0, 7.0, 49.0)))) / 6.0 * 2.0 - 1.0) * 120.0;
        float axis = floor(aSeed2.x * 3.0);
        vec3 step3 = axis < 0.5 ? vec3(1.0, 0.0, 0.0) : (axis < 1.5 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
        vec3 nCell = cell + step3;
        vec3 neighbour = ((nCell + hash3(dot(nCell, vec3(1.0, 7.0, 49.0)))) / 6.0 * 2.0 - 1.0) * 120.0;
        vec3 fil = mix(node, neighbour, aSeed2.y) + (vec3(aSeed2.z, aSeed2.w, aSeed.w) - 0.5) * 7.0;
        vec3 diffuse = (aSeed2.xyz * 2.0 - 1.0) * 120.0;
        pos = mix(diffuse, fil, smoothstep(0.0, 0.35, p) * step(0.25, aSeed.w)) * scl;
        float star = step(0.9, aSeed2.w) * smoothstep(0.08, 0.25, p);
        col = mix(vec3(0.45, 0.5, 0.85) * 0.35, vec3(0.7, 0.85, 1.0) * 1.3, star); size = mix(1.0, 1.3, star);
      } else {                                            // today's sky: starfield + Milky Way band
        if (aSeed2.w < 0.4) {
          float a = aSeed.y * 6.2831853, lat = (aSeed.z - 0.5) * 0.28;
          vec3 band = vec3(cos(a) * cos(lat), sin(lat), sin(a) * cos(lat)) * 290.0;
          pos = vec3(band.x, band.y * 0.9 + band.z * 0.44, band.z * 0.9 - band.y * 0.44);
          col = vec3(1.0, 0.9, 0.75) * 0.5 * (0.3 + aSeed2.x);
        } else {
          pos = d * (220.0 + 100.0 * aSeed2.y);
          col = vec3(0.8, 0.85, 1.0) * 0.4 * (0.2 + aSeed2.x);
        }
        size = 0.8;
      }
    }
    void main() {
      vec3 pA, cA, pB, cB; float sA, sB;
      eraLayout(uEraA, uProgA, uScaleA, pA, cA, sA);
      eraLayout(uEraB, uProgB, uScaleB, pB, cB, sB);
      vec3 pos = mix(pA, pB, uMix);
      vColor = mix(cA, cB, uMix) * (0.8 + 0.2 * sin(uTime * 2.0 + aSeed.w * 60.0));
      vec4 mv = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = uSize * mix(sA, sB, uMix) * uPixelRatio * (220.0 / max(1.0, -mv.z));
    }`;
  const AMBIENT_FRAG = `
    varying vec3 vColor;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = pow(smoothstep(0.5, 0.0, d), 1.6);
      gl_FragColor = vec4(vColor * a, a);
    }`;
  const GRADE = {
    uniforms: {
      tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: GRAIN }, uVignette: { value: VIGNETTE },
      uAberration: { value: ABERRATION }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uExposure: { value: 1 }
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVignette, uAberration, uExposure; uniform vec3 uTint;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
      void main() {
        vec2 dir = vUv - 0.5;
        vec3 c = vec3(texture2D(tDiffuse, vUv + dir * uAberration).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - dir * uAberration).b);
        c = aces(c * uExposure * uTint);
        c *= mix(1.0, smoothstep(0.95, 0.25, length(dir) * 1.25), uVignette);
        c += (hash(vUv * 1024.0 + uTime) - 0.5) * uGrain;
        gl_FragColor = vec4(c, 1.0);
      }`
  };

  /* ── helpers ── */
  function makeRng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  const smooth = u => { const x = Math.min(1, Math.max(0, u)); return x * x * (3 - 2 * x); };
  const lerp = (a, b, k) => a + (b - a) * k;
  function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,240,220,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  /** Era-blend description for time t: previous era (A) → current era (B). Pure function of t. */
  function blendAt(t) {
    const iB = P.eraIndexAt(t), pB = P.eraProgress(t);
    const iA = iB > 0 ? iB - 1 : 0, w = iB > 0 ? smooth(pB / BLEND) : 1;
    return { iA, iB, pA: 1, pB, mix: w };
  }
  /** Visual expansion factor inside an era (log of a/a_start), used by eras after recombination. */
  function visualScale(eraIndex, t) {
    const e = P.ERAS[eraIndex];
    if (e.id !== 'recomb' && e.id !== 'cosmicDawn') return 1;
    const tt = Math.min(Math.max(t, e.start), e.end);
    return 1 + 0.35 * Math.log10(P.scaleFactor(tt) / P.scaleFactor(e.start));
  }

  function create(container, opts = {}) {
    const reducedMotion = !!opts.reducedMotion;
    const onUserCamera = typeof opts.onUserCamera === 'function' ? opts.onUserCamera : () => {};
    const tier = () => TIERS[vis.quality] || TIERS.high;

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setClearColor(BACKGROUND, 1);
    Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%' });
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BACKGROUND);
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 5000);
    camera.position.set(0, 1.5, 9);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    Object.assign(controls, { enableDamping: true, dampingFactor: 0.07, enablePan: false, minDistance: 2, maxDistance: 900 });
    let userCam = false;
    controls.addEventListener('start', () => { userCam = true; onUserCamera(); });

    /* ambient particles */
    const rnd = makeRng(20261119);
    const seeds = new Float32Array(MAX_AMBIENT * 4), seeds2 = new Float32Array(MAX_AMBIENT * 4);
    for (let i = 0; i < seeds.length; i++) { seeds[i] = rnd(); seeds2[i] = rnd(); }
    const ambientGeo = new THREE.BufferGeometry();
    ambientGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_AMBIENT * 3), 3));
    ambientGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    ambientGeo.setAttribute('aSeed2', new THREE.BufferAttribute(seeds2, 4));
    const ambientMat = new THREE.ShaderMaterial({
      uniforms: {
        uEraA: { value: 0 }, uEraB: { value: 0 }, uMix: { value: 1 }, uProgA: { value: 1 }, uProgB: { value: 0 },
        uScaleA: { value: 1 }, uScaleB: { value: 1 }, uTime: { value: 0 }, uSize: { value: 1.6 }, uPixelRatio: { value: 1 }
      },
      vertexShader: AMBIENT_VERT, fragmentShader: AMBIENT_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const ambient = new THREE.Points(ambientGeo, ambientMat);
    ambient.frustumCulled = false;
    scene.add(ambient);

    /* Big Bang core glow (inflation era) */
    const glowTex = glowTexture();
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff3dc, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    scene.add(core);

    /* post-processing */
    const composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 1.5, 0.6, 0.12);
    composer.addPass(bloom);
    const grade = new THREE.ShaderPass(GRADE);
    composer.addPass(grade);

    /* era layers (cosmos-layers.js): { update(state, dt), anchors(state), dispose?() } */
    const layers = [];
    const lctx = { THREE, P, scene, camera, glowTex, smooth, lerp };
    const L = typeof CosmosLayers !== 'undefined' ? CosmosLayers : null;
    const heroL = L && L.hero(lctx), galL = L && L.galaxies(lctx);
    if (L) layers.push(heroL, galL, L.grid(lctx, galL), L.solar(lctx));
    const LABEL_MAX = 12, LABEL_GAP = 48, proj = new THREE.Vector3();

    const state = { t: P.CONST.T_START, showGrid: false, showLabels: false, blend: blendAt(P.CONST.T_START), clock: 0 };
    const tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), ta: new THREE.Vector3(), tb: new THREE.Vector3() };

    function cameraKey(eraIndex, p, outPos, outTarget) {
      const k = CAMERA[P.ERAS[eraIndex].id], s = smooth(p);
      outPos.set(lerp(k.from.pos[0], k.to.pos[0], s), lerp(k.from.pos[1], k.to.pos[1], s), lerp(k.from.pos[2], k.to.pos[2], s));
      outTarget.set(lerp(k.from.target[0], k.to.target[0], s), lerp(k.from.target[1], k.to.target[1], s), lerp(k.from.target[2], k.to.target[2], s));
      return lerp(k.from.fov, k.to.fov, s);
    }
    function applyCamera() {
      const b = state.blend;
      const fovA = cameraKey(b.iA, b.pA, tmp.a, tmp.ta), fovB = cameraKey(b.iB, b.pB, tmp.b, tmp.tb);
      const target = tmp.ta.lerp(tmp.tb, b.mix);
      controls.target.copy(target);
      if (!userCam) {
        camera.position.copy(tmp.a.lerp(tmp.b, b.mix));
        if (!reducedMotion) {
          const c = state.clock;
          camera.position.x += SHAKE * Math.sin(c * 0.7) * Math.sin(c * 0.31);
          camera.position.y += SHAKE * Math.sin(c * 0.53 + 1.3);
        }
        const fov = lerp(fovA, fovB, b.mix);
        if (Math.abs(camera.fov - fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }
      }
      controls.update();
    }

    const vis = {
      quality: TIERS[opts.quality] ? opts.quality : 'high',
      renderer, camera, scene, layers,
      setState(s) {
        if (typeof s.t === 'number' && isFinite(s.t)) state.t = Math.min(Math.max(s.t, P.CONST.T_START), P.ageNow());
        if (s.showGrid !== undefined) state.showGrid = !!s.showGrid;
        if (s.showLabels !== undefined) state.showLabels = !!s.showLabels;
        state.blend = blendAt(state.t);
      },
      render(dt) {
        const d = Math.min(0.1, Math.max(0, dt || 0));
        state.clock += d;
        const b = state.blend, u = ambientMat.uniforms;
        u.uEraA.value = b.iA; u.uEraB.value = b.iB; u.uMix.value = b.mix; u.uProgA.value = b.pA; u.uProgB.value = b.pB;
        u.uScaleA.value = visualScale(b.iA, P.ERAS[b.iA].end); u.uScaleB.value = visualScale(b.iB, state.t);
        u.uTime.value = state.clock;
        const eraB = P.ERAS[b.iB], eraA = P.ERAS[b.iA];
        // grade per era, blended like everything else
        const gu = grade.uniforms;
        gu.uTime.value = state.clock % 100;
        gu.uExposure.value = lerp(eraA.grade.exposure, eraB.grade.exposure, b.mix);
        gu.uTint.value.set(lerp(eraA.grade.tint[0], eraB.grade.tint[0], b.mix), lerp(eraA.grade.tint[1], eraB.grade.tint[1], b.mix), lerp(eraA.grade.tint[2], eraB.grade.tint[2], b.mix));
        bloom.strength = lerp(eraA.grade.bloom, eraB.grade.bloom, b.mix);
        // core glow lives only in the first era, before inflation blows it apart
        const coreOn = b.iB === 0 ? 1 - smooth((b.pB - 0.6) / 0.2) : 0;
        core.material.opacity = 0.18 * coreOn;                 // a glow, not a disc: bloom carries the rest
        core.scale.setScalar(lerp(34, 60, b.iB === 0 ? smooth(b.pB / 0.6) : 1));   // wider than the frame: a glow everywhere, not a ball
        for (const layer of layers) layer.update(state, d);
        applyCamera();
        composer.render(d);
      },
      resize() {
        const w = container.clientWidth, h = container.clientHeight;
        if (!w || !h) return;                                  // hidden or collapsed: keep the last valid size
        renderer.setSize(w, h, false);
        composer.setSize(w, h);
        const s = tier().bloomScale;
        bloom.setSize(Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)));
        camera.aspect = w / h; camera.updateProjectionMatrix();
      },
      heroCount: heroL ? heroL.count : 0,
      /** screen-space label anchors (≤12, ≥48 px apart), empty when labels are off */
      labelAnchors() {
        if (!state.showLabels) return [];
        const w = container.clientWidth, hgt = container.clientHeight, out = [];
        camera.updateMatrixWorld();
        for (const layer of layers) for (const a of layer.anchors(state)) {
          if (out.length >= LABEL_MAX) return out;
          proj.copy(a.pos).project(camera);
          if (proj.z < -1 || proj.z > 1 || Math.abs(proj.x) > 0.95 || Math.abs(proj.y) > 0.95) continue;
          const x = (proj.x + 1) / 2 * w, y = (1 - proj.y) / 2 * hgt;
          if (out.every(o => Math.hypot(o.x - x, o.y - y) >= LABEL_GAP)) out.push({ text: a.text, x, y });
        }
        return out;
      },
      strongPairs: () => (heroL ? heroL.strongPairs() : 0),
      resetCamera() { userCam = false; },
      setQuality(q) {
        if (!TIERS[q]) return;
        vis.quality = q;
        const t = tier();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
        composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
        ambientMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
        ambientGeo.setDrawRange(0, t.ambient);
        grade.uniforms.uGrain.value = reducedMotion ? 0 : GRAIN;
        grade.uniforms.uAberration.value = reducedMotion || !t.aberration ? 0 : ABERRATION;
        vis.resize();
      },
      dispose() {
        ro.disconnect();
        for (const layer of layers) if (layer.dispose) layer.dispose();
        const freed = new Set(), free = x => { if (x && !freed.has(x)) { freed.add(x); x.dispose(); } };
        scene.traverse(o => { free(o.geometry); [].concat(o.material || []).forEach(m => { free(m.map); free(m); }); });
        free(glowTex);
        composer.renderTarget1.dispose(); composer.renderTarget2.dispose();
        bloom.dispose(); free(grade.material);
        controls.dispose();
        renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
      },
      debug: {
        ambientCount: () => ambientGeo.drawRange.count,
        bloomStrength: () => bloom.strength,
        gradePassEnabled: () => grade.enabled,
        gradeUniforms: () => ({ grain: grade.uniforms.uGrain.value, aberration: grade.uniforms.uAberration.value }),
        heroPositions: () => (heroL ? Array.from(heroL.positions()) : []),
        galaxyPositions: () => (galL ? Array.from(galL.positions()) : []),
        galaxyScale: t => (galL ? galL.scaleAt(t) : 1),
        galaxyBox: () => (galL ? galL.box() : 0),
        nucleiCounts: () => (heroL ? heroL.nucleiCounts() : { H: 0, He: 0 })
      },
      /* shared with Task 4 layers */
      internals: { THREE, P, scene, camera, glowTex, smooth, lerp, makeRng, blendAt }
    };

    const ro = new ResizeObserver(() => vis.resize());
    ro.observe(container);
    vis.setQuality(vis.quality);
    return vis;
  }

  return { create, TIERS };
})();
