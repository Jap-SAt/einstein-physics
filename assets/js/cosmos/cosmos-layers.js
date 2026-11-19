/* ════════════════ cosmos-layers: ชั้นภาพเฉพาะยุค ════════════════
   Plug-in layers for CosmosVisuals. Every position is a closed-form function of cosmic time
   (era index + era progress), never a step-by-step simulation, so scrubbing is deterministic.

   Each factory(ctx) returns { update(state, dt), anchors(state) → [{ text, pos: Vector3 }], dispose?() }
   ctx = { THREE, P, scene, camera, glowTex, smooth, lerp }
   state = { t, showGrid, showLabels, blend: { iA, iB, pA, pB, mix }, clock } */
const CosmosLayers = (() => {
  'use strict';

  const fract = x => x - Math.floor(x);
  const h = (i, k) => fract(Math.sin(i * 12.9898 + k * 78.233) * 43758.5453);    // deterministic hash ∈ [0,1)
  const TAU = Math.PI * 2;

  /** weight and progress of era `idx` in the current blend (0 when the era is not on screen) */
  function eraPresence(blend, idx) {
    if (blend.iA === idx && blend.iB === idx) return { w: 1, p: blend.pB };
    if (blend.iB === idx) return { w: blend.mix, p: blend.pB };
    if (blend.iA === idx) return { w: 1 - blend.mix, p: blend.pA };
    return { w: 0, p: 0 };
  }

  /* ───────────── hero particles: quarks → hadrons → nuclei → atoms ───────────── */
  const HERO = 1000, QUARKS = 600, GLUONS = 150;                       // [0,600) quarks · [600,750) gluons/photons · [750,1000) electrons
  const HE_NUCLEI = 14, H_NUCLEI = 166, NUCLEONS = HE_NUCLEI * 4 + H_NUCLEI;  // 166 : 14 ≈ 12 : 1 (≈ 25% He by mass)
  const BOUND_ELECTRONS = HE_NUCLEI * 2 + H_NUCLEI;
  const HB = 14, LINK = 2.0, MAX_LINKS = 1200;
  const HE_OFF = [[0.3, 0.3, 0.3], [-0.3, -0.3, 0.3], [-0.3, 0.3, -0.3], [0.3, -0.3, -0.3]];
  const QUARK_RGB = [[1, 0.32, 0.25], [0.35, 1, 0.45], [0.35, 0.55, 1]];
  const QUARK_LABEL = ['u', 'd'];

  function hero(ctx) {
    const { THREE, P, scene, glowTex, smooth } = ctx;
    const ERA = Object.fromEntries(P.ERAS.map((e, i) => [e.id, i]));
    const pos = new Float32Array(HERO * 3), col = new Float32Array(HERO * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.55, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    points.frustumCulled = false; scene.add(points);
    const linkPos = new Float32Array(MAX_LINKS * 6), linkCol = new Float32Array(MAX_LINKS * 6);
    const linkGeo = new THREE.BufferGeometry();
    linkGeo.setAttribute('position', new THREE.BufferAttribute(linkPos, 3));
    linkGeo.setAttribute('color', new THREE.BufferAttribute(linkCol, 3));
    const links = new THREE.LineSegments(linkGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    links.frustumCulled = false; scene.add(links);
    let pairs = 0, formed = 0;
    const A = { p: new Float32Array(3), c: new Float32Array(3) }, B = { p: new Float32Array(3), c: new Float32Array(3) };

    const centre = (k, out) => { out[0] = (h(k, 11) * 2 - 1) * HB; out[1] = (h(k, 12) * 2 - 1) * HB; out[2] = (h(k, 13) * 2 - 1) * HB; };
    const freeP = (i, p, speed, amp, salt, out) => {
      out[0] = (h(i, salt) * 2 - 1) * HB + amp * Math.sin(p * speed + h(i, salt + 3) * 20);
      out[1] = (h(i, salt + 1) * 2 - 1) * HB + amp * Math.sin(p * speed * 0.86 + h(i, salt + 4) * 20);
      out[2] = (h(i, salt + 2) * 2 - 1) * HB + amp * Math.sin(p * speed * 1.14 + h(i, salt + 5) * 20);
    };
    const set3 = (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; };
    const T = new Float32Array(3), C = new Float32Array(3);

    /** layout of hero particle i in era e at progress p → out.p (position) and out.c (colour × visibility) */
    function layout(e, p, i, out) {
      const op = out.p, oc = out.c;
      set3(oc, 0, 0, 0); set3(op, 0, 0, 0);
      if (e === ERA.quark) {
        const conf = smooth((p - 0.42) / 0.16);                       // confinement at ~1e-6 s
        if (i < QUARKS) {
          const c = i % 3, tid = Math.floor(i / 3), ang = p * 30 + tid;
          freeP(i, p, 140, 1.4, 1, op);
          centre(tid + 500, C);
          const bx = C[0] + 0.45 * Math.cos(ang + c * 2.094), by = C[1] + 0.27 * Math.sin(ang + c * 2.094), bz = C[2] + 0.45 * Math.sin(ang + c * 2.094);
          set3(op, op[0] + (bx - op[0]) * conf, op[1] + (by - op[1]) * conf, op[2] + (bz - op[2]) * conf);
          const q = QUARK_RGB[c], w = 0.3 * conf;
          set3(oc, q[0] * (1 - w) + w, q[1] * (1 - w) + w, q[2] * (1 - w) + w);
        } else if (i < QUARKS + GLUONS) {
          freeP(i, p, 170, 1.8, 31, op); const v = 0.8 * (1 - conf);
          set3(oc, v, v * 0.9, v * 0.45);
        } else { freeP(i, p, 110, 1.6, 61, op); set3(oc, 0.35, 0.55, 1.0); }
      } else if (e === ERA.nucleo || e === ERA.radiation || e === ERA.recomb) {
        const f = e === ERA.nucleo ? smooth((p - 0.2) / 0.4) : 1;     // nuclei form across nucleosynthesis
        if (i < NUCLEONS) {
          let k, off = null, proton = true;
          if (i < HE_NUCLEI * 4) { k = Math.floor(i / 4); off = HE_OFF[i % 4]; proton = i % 4 < 2; }
          else k = HE_NUCLEI + (i - HE_NUCLEI * 4);
          centre(k, C);
          if (off) { C[0] += off[0]; C[1] += off[1]; C[2] += off[2]; }
          freeP(i, p, 60, 1.0, 21, T);
          set3(op, T[0] + (C[0] - T[0]) * f, T[1] + (C[1] - T[1]) * f, T[2] + (C[2] - T[2]) * f);
          if (proton) set3(oc, 1.0, 0.42, 0.26); else set3(oc, 0.75, 0.77, 0.85);
          if (e === ERA.recomb) {                                     // neutral atoms dim into the dark ages
            const g = smooth((p - 0.03) / 0.09), fade = 1 - 0.75 * smooth((p - 0.3) / 0.2);   // dark ages: neutral gas stays, faintly
            set3(oc, (oc[0] * (1 - g) + 0.8 * g) * fade, (oc[1] * (1 - g) + 0.78 * g) * fade, (oc[2] * (1 - g) + 0.7 * g) * fade);
          }
        } else if (i >= QUARKS && i < QUARKS + GLUONS) {              // photons
          if (e === ERA.recomb) {                                     // released: they stream away (the CMB)
            const r = HB + 400 * smooth((p - 0.05) / 0.3), a = h(i, 41) * TAU, z = h(i, 42) * 2 - 1, s = Math.sqrt(1 - z * z);
            set3(op, Math.cos(a) * s * r, z * r, Math.sin(a) * s * r);
            const v = 1 - smooth((p - 0.1) / 0.25); set3(oc, v, 0.6 * v, 0.25 * v);
          } else if (e === ERA.radiation) { freeP(i, p, 220, 2.5, 45, op); set3(oc, 1.0, 0.85, 0.45); }
        } else if (i >= QUARKS + GLUONS) {                             // electrons
          const j = i - QUARKS - GLUONS;
          freeP(i, p, 110, 1.6, 61, op);
          if (e === ERA.recomb && j < BOUND_ELECTRONS) {
            const k = j < HE_NUCLEI * 2 ? Math.floor(j / 2) : HE_NUCLEI + (j - HE_NUCLEI * 2);
            centre(k, C);
            const g = smooth((p - 0.03) / 0.09), a = p * 200 + j, R = 0.9;
            set3(op, op[0] + (C[0] + R * Math.cos(a) - op[0]) * g, op[1] + (C[1] + 0.5 * R * Math.sin(a) - op[1]) * g, op[2] + (C[2] + R * Math.sin(a) - op[2]) * g);
          }
          const fade = e === ERA.recomb ? 1 - 0.75 * smooth((p - 0.3) / 0.2) : 1;
          set3(oc, 0.35 * fade, 0.55 * fade, 1.0 * fade);
        }
      }
    }

    function updateLinks(active) {
      pairs = 0;
      if (!active) { linkGeo.setDrawRange(0, 0); return; }
      const cells = new Map(), key = (x, y, z) => x + ',' + y + ',' + z;
      for (let i = 0; i < QUARKS; i++) {
        const k = key(Math.floor(pos[i * 3] / LINK), Math.floor(pos[i * 3 + 1] / LINK), Math.floor(pos[i * 3 + 2] / LINK));
        let list = cells.get(k); if (!list) cells.set(k, list = []); list.push(i);
      }
      for (let i = 0; i < QUARKS && pairs < MAX_LINKS; i++) {
        const cx = Math.floor(pos[i * 3] / LINK), cy = Math.floor(pos[i * 3 + 1] / LINK), cz = Math.floor(pos[i * 3 + 2] / LINK);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          const list = cells.get(key(cx + dx, cy + dy, cz + dz)); if (!list) continue;
          for (const j of list) {
            if (j <= i || pairs >= MAX_LINKS) continue;
            const d = Math.hypot(pos[i * 3] - pos[j * 3], pos[i * 3 + 1] - pos[j * 3 + 1], pos[i * 3 + 2] - pos[j * 3 + 2]);
            if (d >= LINK) continue;
            const s = (1 - d / LINK) * 0.8, o = pairs * 6;
            for (let c = 0; c < 3; c++) {
              linkPos[o + c] = pos[i * 3 + c]; linkPos[o + 3 + c] = pos[j * 3 + c];
              linkCol[o + c] = col[i * 3 + c] * s; linkCol[o + 3 + c] = col[j * 3 + c] * s;
            }
            pairs++;
          }
        }
      }
      linkGeo.setDrawRange(0, pairs * 2);
      linkGeo.attributes.position.needsUpdate = true; linkGeo.attributes.color.needsUpdate = true;
    }

    return {
      update(state) {
        const b = state.blend, eA = b.iA, eB = b.iB, m = b.mix;
        for (let i = 0; i < HERO; i++) {
          layout(eA, b.pA, i, A); layout(eB, b.pB, i, B);
          for (let c = 0; c < 3; c++) {
            pos[i * 3 + c] = A.p[c] + (B.p[c] - A.p[c]) * m;
            col[i * 3 + c] = A.c[c] + (B.c[c] - A.c[c]) * m;
          }
        }
        geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
        updateLinks(eB === ERA.quark && m > 0.5);
        formed = eB === ERA.nucleo ? smooth((b.pB - 0.2) / 0.4) : (eB > ERA.nucleo && eB <= ERA.recomb ? 1 : 0);
      },
      anchors(state) {
        const out = [], eB = state.blend.iB;
        const pick = (i, text) => out.push({ text, pos: new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]) });
        if (eB === ERA.quark) {
          for (let i = 0; i < QUARKS; i += 17) pick(i, QUARK_LABEL[Math.floor(i / 3) % 2] + ' ควาร์ก');
          for (let i = QUARKS; i < QUARKS + GLUONS; i += 23) if (state.blend.pB < 0.5) pick(i, 'g กลูออน');
          for (let i = QUARKS + GLUONS; i < HERO; i += 29) pick(i, 'e⁻');
        } else if (eB === ERA.nucleo || eB === ERA.radiation) {
          for (let k = 0; k < HE_NUCLEI; k += 2) { pick(HE_NUCLEI * 4 + k * 11, 'p⁺ (¹H)'); pick(HE_NUCLEI * 4 + k * 11 + 5, 'p⁺ (¹H)'); pick(k * 4, '⁴He'); }
          if (eB === ERA.radiation) for (let i = QUARKS; i < QUARKS + GLUONS; i += 25) pick(i, 'γ โฟตอน');
        } else if (eB === ERA.recomb && state.blend.pB < 0.3) {
          for (let i = HE_NUCLEI * 4; i < NUCLEONS; i += 13) pick(i, 'อะตอม H');
          for (let i = QUARKS; i < QUARKS + GLUONS; i += 25) pick(i, 'γ โฟตอน');
        }
        return out;
      },
      count: HERO,
      strongPairs: () => pairs,
      positions: () => pos.slice(),
      nucleiCounts: () => (formed >= 0.5 ? { H: H_NUCLEI, He: HE_NUCLEI } : { H: 0, He: 0 })
    };
  }

  /* ───────────── galaxies on a comoving lattice (no centre of expansion) ───────────── */
  const GAL_SIDE = 8, GAL_HALF = 120;
  function spiralTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const core = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    core.addColorStop(0, 'rgba(255,236,200,1)'); core.addColorStop(0.12, 'rgba(255,210,150,.55)'); core.addColorStop(0.5, 'rgba(120,150,255,.08)'); core.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = core; g.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 2600; k++) {                                   // two log-spiral arms of stars
      const arm = k % 2, t = h(k, 1), r = 8 + t * 112, a = arm * Math.PI + Math.log(r / 8) * 2.1 + (h(k, 2) - 0.5) * 0.7;
      const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r, s = 0.6 + h(k, 3) * 1.4;
      g.fillStyle = h(k, 4) < 0.06 ? 'rgba(255,140,190,.8)' : `rgba(${170 + 60 * (1 - t) | 0},${190 + 40 * (1 - t) | 0},255,${0.55 * (1 - t * 0.6)})`;
      g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
    }
    return new THREE.CanvasTexture(c);
  }
  function galaxies(ctx) {
    const { THREE, P, scene, smooth } = ctx;
    const idx = P.ERAS.findIndex(e => e.id === 'cosmicDawn'), era = P.ERAS[idx];
    const n = GAL_SIDE ** 3, tex = spiralTexture();
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0 }), n);
    mesh.frustumCulled = false; scene.add(mesh);
    const comoving = new Float32Array(n * 3), phys = new Float32Array(n * 3), quats = [], sizes = new Float32Array(n);
    const dummy = new THREE.Object3D(), tint = new THREE.Color();
    for (let i = 0, ix = 0; ix < GAL_SIDE; ix++) for (let iy = 0; iy < GAL_SIDE; iy++) for (let iz = 0; iz < GAL_SIDE; iz++, i++) {
      comoving[i * 3] = ((ix + 0.5) / GAL_SIDE * 2 - 1) * GAL_HALF + (h(i, 1) - 0.5) * 22;
      comoving[i * 3 + 1] = ((iy + 0.5) / GAL_SIDE * 2 - 1) * GAL_HALF + (h(i, 2) - 0.5) * 22;
      comoving[i * 3 + 2] = ((iz + 0.5) / GAL_SIDE * 2 - 1) * GAL_HALF + (h(i, 3) - 0.5) * 22;
      quats.push(new THREE.Quaternion().setFromEuler(new THREE.Euler(h(i, 4) * TAU, h(i, 5) * TAU, h(i, 6) * TAU)));
      sizes[i] = 3.5 + h(i, 7) * 4;
    }
    /** visual expansion inside the galaxy era: log of a/a_start (true a(t) shown in the HUD) */
    const scaleAt = t => 1 + 0.35 * Math.log10(P.scaleFactor(Math.min(Math.max(t, era.start), era.end)) / P.scaleFactor(era.start));
    let currentScale = 1, maturity = 0, visible = 0, lastT = era.start;
    return {
      update(state) {
        const pr = eraPresence(state.blend, idx);
        lastT = state.t;
        visible = pr.w * smooth(pr.p / 0.08);
        mesh.visible = visible > 0.001;
        mesh.material.opacity = visible;
        if (!mesh.visible) return;
        currentScale = scaleAt(state.t);
        maturity = smooth((pr.p - 0.08) / 0.35);                     // first stars → spirals
        for (let i = 0; i < n; i++) {
          for (let c = 0; c < 3; c++) phys[i * 3 + c] = comoving[i * 3 + c] * currentScale;
          dummy.position.set(phys[i * 3], phys[i * 3 + 1], phys[i * 3 + 2]);
          dummy.quaternion.copy(quats[i]);
          dummy.rotateZ(pr.p * 3 + i);                                // slow rotation
          dummy.scale.setScalar(sizes[i] * (0.3 + 0.7 * maturity));
          dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
          tint.setRGB(0.6 + 0.4 * maturity, 0.75 + 0.2 * maturity, 1.0).multiplyScalar(0.8 + 0.4 * h(i, 8));
          mesh.setColorAt(i, tint);
        }
        mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      },
      anchors(state) {
        if (visible < 0.3) return [];
        const cam = ctx.camera.position, idxs = [];
        for (let i = 0; i < n; i++) idxs.push(i);
        idxs.sort((a, b) => dist2(a) - dist2(b));
        function dist2(i) { return (phys[i * 3] - cam.x) ** 2 + (phys[i * 3 + 1] - cam.y) ** 2 + (phys[i * 3 + 2] - cam.z) ** 2; }
        const text = maturity > 0.4 ? 'กาแล็กซี' : 'ดาวฤกษ์รุ่นแรก';
        return idxs.slice(0, 4).map(i => ({ text, pos: new THREE.Vector3(phys[i * 3], phys[i * 3 + 1], phys[i * 3 + 2]) }));
      },
      /** physical positions at the last rendered time = comoving × scale (uniform, centre-free) */
      positions: () => { const s = scaleAt(lastT), out = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) out[i] = comoving[i] * s; return out; },
      scaleAt,
      box: () => 2 * GAL_HALF * scaleAt(lastT),
      nearest: () => phys,
      count: n
    };
  }

  /* ───────────── space-time grid (glowing vector lines) ───────────── */
  function grid(ctx, gal) {
    const { THREE, P, scene, smooth } = ctx;
    const LINES = 41, SAMPLES = 81, EXTENT = 160, Y = -18;
    const verts = LINES * 2 * (SAMPLES - 1) * 2;
    const arr = new Float32Array(verts * 3), geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x5aa6ff, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
    lines.frustumCulled = false; scene.add(lines);
    const inf = P.ERAS.findIndex(e => e.id === 'inflation'), dawn = P.ERAS.findIndex(e => e.id === 'cosmicDawn');
    function spacing(state) {
      const b = state.blend;
      if (b.iB === inf) return 0.03 + 0.97 * Math.pow(smooth((b.pB - 0.6) / 0.4), 2.5);   // stretched by inflation
      if (b.iB === dawn) return gal.scaleAt(state.t);
      return 1;
    }
    return {
      update(state) {
        lines.visible = state.showGrid;
        if (!lines.visible) return;
        const s = spacing(state), half = EXTENT * s, pr = eraPresence(state.blend, dawn), depth = 6 * pr.w * smooth((pr.p - 0.1) / 0.3);
        const wells = [];
        if (depth > 0.01) { const g = gal.nearest(); for (let i = 0; i < g.length / 3 && wells.length < 24; i += 21) wells.push([g[i * 3], g[i * 3 + 2]]); }
        const yAt = (x, z) => { let y = Y; for (const w of wells) { const d2 = (x - w[0]) ** 2 + (z - w[1]) ** 2; y -= depth * Math.exp(-d2 / 260); } return y; };
        let o = 0;
        for (let dir = 0; dir < 2; dir++) for (let l = 0; l < LINES; l++) {
          const fixed = (l / (LINES - 1) * 2 - 1) * half;
          for (let k = 0; k < SAMPLES - 1; k++) {
            for (const kk of [k, k + 1]) {
              const run = (kk / (SAMPLES - 1) * 2 - 1) * half, x = dir ? run : fixed, z = dir ? fixed : run;
              arr[o++] = x; arr[o++] = yAt(x, z); arr[o++] = z;
            }
          }
        }
        geo.attributes.position.needsUpdate = true;
      },
      anchors: () => []
    };
  }

  /* ───────────── solar system, Earth and life ───────────── */
  function earthTexture(THREE) {
    const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), sea = g.createLinearGradient(0, 0, 0, H);
    sea.addColorStop(0, '#0d2f5c'); sea.addColorStop(0.5, '#1b5a9a'); sea.addColorStop(1, '#0d2f5c');
    g.fillStyle = sea; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 14; k++) {
      const cx = h(k, 1) * W, cy = 50 + h(k, 2) * 156, blobs = 18 + h(k, 3) * 30;
      for (let j = 0; j < blobs; j++) {
        const x = cx + (h(k * 100 + j, 4) - 0.5) * 90, y = cy + (h(k * 100 + j, 5) - 0.5) * 50, r = 6 + h(k * 100 + j, 6) * 16;
        g.fillStyle = h(k * 100 + j, 7) < 0.7 ? '#2f6b3a' : '#7a6a45';
        for (const wx of [x, (x + W) % W]) { g.beginPath(); g.arc(wx, y, r, 0, TAU); g.fill(); }
      }
    }
    g.fillStyle = '#e9f0f5'; g.fillRect(0, 0, W, 14); g.fillRect(0, H - 14, W, 14);
    g.globalAlpha = 0.35; g.fillStyle = '#fff';
    for (let j = 0; j < 160; j++) { g.beginPath(); g.ellipse(h(j, 8) * W, 20 + h(j, 9) * 216, 8 + h(j, 10) * 26, 3 + h(j, 11) * 5, 0, 0, TAU); g.fill(); }
    return new THREE.CanvasTexture(c);
  }
  function solar(ctx) {
    const { THREE, P, scene, glowTex, smooth } = ctx;
    const idx = P.ERAS.findIndex(e => e.id === 'solar');
    const group = new THREE.Group(); scene.add(group);
    const light = new THREE.PointLight(0xffd8a0, 0, 200); group.add(light);
    group.add(new THREE.AmbientLight(0xffffff, 0.12));
    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffcf7a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    sunGlow.scale.setScalar(9); group.add(sunGlow);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 20), new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0 })); group.add(sun);
    const DISK = 12000, dPos = new Float32Array(DISK * 3), dCol = new Float32Array(DISK * 3), dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3)); dGeo.setAttribute('color', new THREE.BufferAttribute(dCol, 3));
    const disk = new THREE.Points(dGeo, new THREE.PointsMaterial({ size: 0.12, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    disk.frustumCulled = false; group.add(disk);
    const planets = [[3, 0.14, 0xb7a58f], [4.5, 0.22, 0xe2c08a], [8.5, 0.18, 0xc96a44], [12, 0.5, 0xd9b48a]].map(([r, s, c], q) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(s, 20, 14), new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, transparent: true, opacity: 0 }));
      m.userData = { r, ph: q * 1.7 }; group.add(m); return m;
    });
    const EARTH = new THREE.Vector3(4, 0, 0);
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1.6, 64, 40), new THREE.MeshStandardMaterial({ map: earthTexture(THREE), roughness: 0.85, transparent: true, opacity: 0 }));
    earth.position.copy(EARTH); earth.rotation.z = THREE.MathUtils.degToRad(23.4); group.add(earth);
    const atmo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x6fb0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    atmo.position.copy(EARTH); atmo.scale.setScalar(5.2); group.add(atmo);
    const DNA = 2400, nPos = new Float32Array(DNA * 3), nCol = new Float32Array(DNA * 3), nGeo = new THREE.BufferGeometry();
    nGeo.setAttribute('position', new THREE.BufferAttribute(nPos, 3)); nGeo.setAttribute('color', new THREE.BufferAttribute(nCol, 3));
    const dna = new THREE.Points(nGeo, new THREE.PointsMaterial({ size: 0.09, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    dna.frustumCulled = false; group.add(dna);
    const DNA_AT = new THREE.Vector3(8.6, 0, 0);
    let vis = 0, prog = 0;
    return {
      update(state) {
        const pr = eraPresence(state.blend, idx);
        vis = pr.w; prog = pr.p; group.visible = vis > 0.001;
        if (!group.visible) return;
        const p = prog, sunOn = vis * smooth(p / 0.02), diskOn = sunOn * (1 - smooth((p - 0.08) / 0.06));
        sunGlow.material.opacity = sunOn * (1 - 0.7 * smooth((p - 0.12) / 0.1)); sun.material.opacity = sunOn;
        light.intensity = 2.2 * sunOn;
        const tau = p * 60;
        for (let i = 0; i < DISK; i++) {                              // Kepler disk: ω ∝ r^(-3/2)
          const r = 1.6 + 16 * Math.pow(h(i, 51), 1.3), a = h(i, 52) * TAU + 3.5 / Math.pow(r, 1.5) * tau, y = (h(i, 53) - 0.5) * 0.12 * Math.sqrt(r);
          dPos[i * 3] = Math.cos(a) * r; dPos[i * 3 + 1] = y; dPos[i * 3 + 2] = Math.sin(a) * r;
          const f = Math.min(1, (r - 1.6) / 16), v = diskOn * 0.9;
          dCol[i * 3] = (1 - 0.1 * f) * v; dCol[i * 3 + 1] = (0.85 - 0.45 * f) * v; dCol[i * 3 + 2] = (0.55 - 0.45 * f) * v;
        }
        dGeo.attributes.position.needsUpdate = true; dGeo.attributes.color.needsUpdate = true;
        planets.forEach((m, q) => {
          const grow = vis * smooth((p - 0.02 - q * 0.015) / 0.05) * (1 - smooth((p - 0.12) / 0.04));
          m.material.opacity = grow; m.scale.setScalar(0.2 + 0.8 * grow);
          const a = m.userData.ph + 3.5 / Math.pow(m.userData.r, 1.5) * tau; m.position.set(Math.cos(a) * m.userData.r, 0, Math.sin(a) * m.userData.r);
        });
        const earthOn = vis * smooth((p - 0.08) / 0.06), molten = 1 - smooth((p - 0.12) / 0.12);
        earth.material.opacity = earthOn; earth.scale.setScalar(Math.max(0.01, earthOn));
        earth.material.color.setRGB(1, 1 - 0.55 * molten, 1 - 0.8 * molten);
        earth.rotation.y = p * 80;
        atmo.material.opacity = vis * 0.7 * smooth((p - 0.15) / 0.1);
        const life = vis * smooth((p - 0.27) / 0.08), spin = p * 30;
        for (let i = 0; i < DNA; i++) {                               // double helix with base pairs
          const s = i / DNA, kind = i % 3, th = s * TAU * 3.5 + spin;
          if (kind < 2) {
            const a = th + kind * Math.PI;
            nPos[i * 3] = DNA_AT.x + Math.cos(a) * 0.6; nPos[i * 3 + 1] = -2.5 + 5 * s; nPos[i * 3 + 2] = DNA_AT.z + Math.sin(a) * 0.6;
            nCol[i * 3] = (kind ? 0.32 : 0.28) * life; nCol[i * 3 + 1] = (kind ? 0.6 : 0.9) * life; nCol[i * 3 + 2] = (kind ? 0.95 : 0.66) * life;
          } else {
            const sq = Math.floor(s * 40) / 40, a = sq * TAU * 3.5 + spin, u = h(i, 61) * 2 - 1;
            nPos[i * 3] = DNA_AT.x + Math.cos(a) * 0.6 * u; nPos[i * 3 + 1] = -2.5 + 5 * sq; nPos[i * 3 + 2] = DNA_AT.z + Math.sin(a) * 0.6 * u;
            nCol[i * 3] = 0.85 * life; nCol[i * 3 + 1] = 0.66 * life; nCol[i * 3 + 2] = 0.36 * life;
          }
        }
        nGeo.attributes.position.needsUpdate = true; nGeo.attributes.color.needsUpdate = true;
      },
      anchors() {
        if (vis < 0.3) return [];
        const out = [];
        if (prog < 0.14) out.push({ text: 'ดวงอาทิตย์', pos: new THREE.Vector3(0, 1.4, 0) });
        if (prog > 0.1) out.push({ text: 'โลก', pos: EARTH.clone().add(new THREE.Vector3(0, 2.1, 0)) });
        if (prog > 0.3) out.push({ text: 'DNA · สิ่งมีชีวิต', pos: DNA_AT.clone().add(new THREE.Vector3(0, 3, 0)) });
        return out;
      }
    };
  }

  return { hero, galaxies, grid, solar };
})();
