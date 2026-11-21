/* ─────────── Sim : electric-field lab (บทที่ 04 ไฟฟ้าสถิต) ───────────
   Point charges sit on the floor plane y = 0. 1 scene unit = 1 cm, charges in µC, k = 9.0×10⁹ N·m²/C².
   • 3D field lines: EField.traceLines (RK4), rebuilt only when the charges change; fewer lines while dragging.
   • Potential floor: a ShaderMaterial computes V = Σ kqᵢ/rᵢ per pixel (up to 32 charges, uCount drives the loop,
     r clamped at EField.R_MIN) and draws equipotentials in equal steps ΔV (closer contours = stronger field).
     ΔV is chosen per scene from a 1-2-5 ladder so contours near the charges stay readable; contours closer
     than a few pixels fade out instead of turning into noise. Colour: warm = V > 0, cool = V < 0,
     log-compressed and clamped near the charges.
   • Learners place up to 8 charges. The parallel-plates preset is a locked demo: two vertical sheets of
     5 × 3 point charges (1.5 cm apart, 4 cm gap) so the field in the gap is close to uniform.
   • Test charge: v += (qE/m_eff)·dt with damping and a speed cap — a qualitative picture only.
   Debug/test hook: window.__ef (like __px). */
function simEField(host, U) {
  const { world, camera, renderer, controls, scene } = host;
  const canvas = renderer.domElement, stage = canvas.parentElement;
  // portrait stages (phones) see a narrower slice of the floor: back the camera off
  const aspect = stage && stage.clientHeight ? stage.clientWidth / stage.clientHeight : 1.4;
  const far = Math.min(1.6, Math.max(1, 1.0 / aspect));
  // the plates demo is viewed along the sheets (from +x) so the gap and its straight field lines face the learner
  const VIEWS = { wide: [0, 32, 29, 0.5], plates: [15, 13, 0.01, 0] };   // camera x, y, z, target z
  let view = '';
  function setView(v) {
    if (v === view) return; view = v; const a = VIEWS[v];
    host.setHome(new THREE.Vector3(a[0] * far, a[1] * far, a[2] * far), new THREE.Vector3(0, 0, a[3]));
  }

  const HALF = 20, PLACE = 18, MAXN = 8, MAXU = 32, QDEF = 2, SNAP = 0.5, R_DRAW = 30;
  const RMIN = EField.R_MIN;
  const LOCK_NOTE = 'ฉากแผ่นขนานเป็น<b>ฉากสาธิต</b> (แผ่นละ 5 × 3 ประจุจุด ห่างกัน 1.5 cm ช่องกว้าง 4 cm) จึงย้ายหรือแก้ค่าประจุไม่ได้ · กด <b>ล้างฉาก</b> เพื่อวางประจุเอง';
  const POS = 0xd94a3a, NEG = 0x2f6fd1, ZERO = 0x8a8f99, PROBE = 0x1c9a5a, TEST = 0xe0912b;
  const KV = 9.0e9 * 1e-6 / 0.01;          // V per (µC / cm)
  const DV_PLATES = 5e5;                    // plates demo: ~7 equipotentials across the 4 cm gap
  const LADDER = []; for (let e = 3; e <= 7; e++) [1, 2, 5].forEach(m => LADDER.push(m * Math.pow(10, e)));
  const V0 = 5e4, VSAT = 2e6;               // colour scale: log(1+|V|/V0), saturates at VSAT
  // lines per µC: 8, but at most ~36 lines leave the sources in total (keeps 8-charge scenes readable);
  // within one scene the count stays proportional to |q|
  const FULL = { perUnitCharge: 8, step: 0.25, maxSteps: 2400, bound: 300 }, FULL_MAX = 36;
  const FAST = { perUnitCharge: 3, step: 0.5, maxSteps: 260, bound: 50 }, FAST_MAX = 12;
  const G_ACC = 1.5e-5, DAMP = 2.0, VMAX = 12;   // test charge: cm/s² per N/C, 1/s, cm/s

  const saved = simEField.saved || null;
  const st = {
    charges: saved ? saved.charges.map(c => ({ x: c.x, y: c.y || 0, z: c.z, q: c.q })) : [],
    locked: saved ? !!saved.locked : false,
    dv: 5e4,
    sel: saved ? saved.sel : -1,
    mode: saved ? saved.mode : 'probe',
    showLines: saved ? saved.showLines : true,
    showFloor: saved ? saved.showFloor : true,
    probe: saved ? { x: saved.probe.x, z: saved.probe.z } : { x: 0, z: 7 },
    play: true
  };
  let traced = [], fullDone = true, dirtyFast = false, lastCont = 0, frames = 0, built = false;
  let msgTimer = 0, uiReady = false, onChargeMsg = false;

  /* ── theme ── */
  const PAL = {
    light: { neutral: [0.953, 0.945, 0.933], warm: [0.90, 0.42, 0.32], cool: [0.32, 0.52, 0.88], ink: [0.15, 0.17, 0.21], inkA: 0.55, line: 0x30343d, lineA: 0.9, alpha: 0.86 },
    dark: { neutral: [0.105, 0.11, 0.125], warm: [0.68, 0.23, 0.16], cool: [0.18, 0.34, 0.74], ink: [0.93, 0.94, 0.96], inkA: 0.38, line: 0xdfe4ee, lineA: 0.85, alpha: 0.88 }
  };
  const pal = () => PAL[isDark() ? 'dark' : 'light'];
  const css = a => `rgb(${Math.round(a[0] * 255)},${Math.round(a[1] * 255)},${Math.round(a[2] * 255)})`;
  const hex = a => '#' + a.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

  /* ── potential floor ── */
  const uC = []; for (let i = 0; i < MAXU; i++) uC.push(new THREE.Vector4(0, 0, 0, 0));
  const floorMat = new THREE.ShaderMaterial({
    uniforms: {
      uC: { value: uC }, uCount: { value: 0 },
      uStep: { value: 5e4 / KV }, uS0: { value: V0 / KV }, uLogSat: { value: Math.log(1 + VSAT / V0) },
      uContour: { value: 1 }, uAlpha: { value: 0.86 }, uHalf: { value: HALF },
      uNeutral: { value: new THREE.Color() }, uWarm: { value: new THREE.Color() }, uCool: { value: new THREE.Color() },
      uInk: { value: new THREE.Color() }, uInkA: { value: 0.4 }
    },
    vertexShader: `varying vec2 vP;
      void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec4 uC[${MAXU}];   // x, y, z, q (µC)
      uniform int uCount;
      uniform float uStep, uS0, uLogSat, uContour, uAlpha, uHalf, uInkA;
      uniform vec3 uNeutral, uWarm, uCool, uInk;
      varying vec2 vP;
      void main() {
        // s = Σ q/r in µC/cm (V = 9e5·s volts); r clamped like EField.R_MIN so nothing blows up
        float s = 0.0;
        for (int i = 0; i < ${MAXU}; i++) {
          if (i >= uCount) break;
          vec4 c = uC[i];
          float r = max(length(vec3(vP.x - c.x, -c.y, vP.y - c.z)), ${RMIN.toFixed(4)});
          s += c.w / r;
        }
        float u = clamp(log(1.0 + abs(s) / uS0) / uLogSat, 0.0, 1.0);
        vec3 col = mix(uNeutral, s >= 0.0 ? uWarm : uCool, pow(u, 0.85));
        if (uContour > 0.5) {
          float f = s / uStep;
          float w = max(fwidth(f), 1e-6);
          float d = abs(fract(f + 0.5) - 0.5);
          float line = 1.0 - smoothstep(0.45 * w, 1.5 * w, d);
          float fade = 1.0 - smoothstep(0.14, 0.3, w);   // contours closer than ~4–7 px fade out
          col = mix(col, uInk, line * fade * uInkA);
        }
        float e = max(abs(vP.x), abs(vP.y));
        gl_FragColor = vec4(col, uAlpha * (1.0 - smoothstep(uHalf - 2.5, uHalf, e)));
      }`,
    transparent: true, side: THREE.DoubleSide, depthWrite: false
  });
  floorMat.extensions = { derivatives: true };
  const floorGeo = new THREE.PlaneGeometry(2 * HALF, 2 * HALF, 1, 1); floorGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeo, floorMat); floor.renderOrder = 2; world.add(floor);
  let grid = null;

  /* ── field lines + arrowheads ── */
  const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true });
  const lines = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat); lines.renderOrder = 1; lines.frustumCulled = false; world.add(lines);
  const MAXA = 4000;
  const coneGeo = new THREE.ConeGeometry(0.18, 0.6, 10); coneGeo.translate(0, 0.1, 0);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0x30343d });
  const arrows = new THREE.InstancedMesh(coneGeo, coneMat, MAXA); arrows.count = 0; arrows.frustumCulled = false; world.add(arrows);

  /* ── charges ── */
  const ballGeo = new THREE.SphereGeometry(1, 28, 18);
  const glyphs = {};
  function glyph(ch) {
    if (glyphs[ch]) return glyphs[ch];
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.font = '700 54px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ch, 32, 35);
    const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; return (glyphs[ch] = t);
  }
  const chargeGroup = new THREE.Group(); world.add(chargeGroup);
  // faint sheets behind the plates demo's point charges, so they read as two plates
  const plateGroup = new THREE.Group(); plateGroup.visible = false; world.add(plateGroup);
  [[-2, POS], [2, NEG]].forEach(([z, col]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 4.6), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
    m.position.set(0, 0, z); m.renderOrder = 3; plateGroup.add(m);
  });
  const objs = [];
  const radius = q => 0.38 + 0.09 * Math.abs(q);
  function syncCharges() {
    while (objs.length > st.charges.length) {
      const o = objs.pop(); chargeGroup.remove(o.ball, o.sign); o.ball.material.dispose(); o.sign.material.dispose();
    }
    while (objs.length < st.charges.length) {
      const ball = new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({ color: POS, roughness: 0.35, metalness: 0.05 }));
      const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyph('+'), depthTest: false, transparent: true }));
      sign.renderOrder = 5; chargeGroup.add(ball, sign); objs.push({ ball, sign, ch: '' });
    }
    st.charges.forEach((c, i) => {
      const o = objs[i], r = radius(c.q);
      o.ball.position.set(c.x, c.y, c.z); o.ball.scale.setScalar(r);
      o.ball.material.color.setHex(c.q > 0 ? POS : c.q < 0 ? NEG : ZERO);
      const ch = c.q > 0 ? '+' : c.q < 0 ? '−' : '0';
      if (o.ch !== ch) { o.sign.material.map = glyph(ch); o.sign.material.needsUpdate = true; o.ch = ch; }
      o.sign.position.set(c.x, c.y, c.z); o.sign.scale.setScalar(r * 1.25);
    });
    plateGroup.visible = st.locked;
    syncSelMarker();
  }
  // selection: ring on the floor + a small label with q
  const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.16, 48), new THREE.MeshBasicMaterial({ color: inkHex(), side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; world.add(ring);
  let selLabel = null, selLabelText = '';
  function syncSelMarker() {
    const c = st.charges[st.sel];
    ring.visible = !!c;
    if (!c) { if (selLabel) selLabel.visible = false; return; }
    const r = radius(c.q) + 0.35;
    ring.position.set(c.x, 0.03, c.z); ring.scale.setScalar(r);
    const txt = qStr(c.q);
    if (txt !== selLabelText || !selLabel) {
      if (selLabel) { world.remove(selLabel); selLabel.material.map.dispose(); selLabel.material.dispose(); }
      selLabel = makeLabel(txt, isDark() ? '#ecE9e2' : '#17191e', 0.95); selLabel.renderOrder = 6; selLabel.material.depthTest = false;
      world.add(selLabel); selLabelText = txt;
    }
    selLabel.visible = true; selLabel.position.set(c.x, radius(c.q) + 1.5, c.z);
  }

  /* ── probe (readout point) + test charge ── */
  const probeArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 2.4, PROBE, 0.8, 0.5);
  const probeDot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), new THREE.MeshBasicMaterial({ color: PROBE }));
  world.add(probeArrow, probeDot);
  const tcMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 12), new THREE.MeshStandardMaterial({ color: TEST, emissive: TEST, emissiveIntensity: 0.25, roughness: 0.4 }));
  tcMesh.visible = false; world.add(tcMesh);
  const TN = 1600, tp = new Float32Array(TN * 3), tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tg.setDrawRange(0, 0);
  const trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: TEST })); trail.frustumCulled = false; world.add(trail);
  const tc = { active: false, x: 0, z: 0, vx: 0, vz: 0, n: 0, why: '' };
  const ebuf = [0, 0, 0];

  function applyTheme() {
    const p = pal();
    floorMat.uniforms.uNeutral.value.setRGB(...p.neutral);
    floorMat.uniforms.uWarm.value.setRGB(...p.warm);
    floorMat.uniforms.uCool.value.setRGB(...p.cool);
    floorMat.uniforms.uInk.value.setRGB(...p.ink);
    floorMat.uniforms.uInkA.value = p.inkA; floorMat.uniforms.uAlpha.value = p.alpha;
    coneMat.color.setHex(p.line); if (built) buildLines(false);
    ring.material.color.setHex(inkHex());
    if (grid) { world.remove(grid); grid.geometry.dispose(); grid.material.dispose(); }
    grid = new THREE.GridHelper(2 * HALF, 20, gridHex()[0], gridHex()[1]); grid.visible = !st.showFloor; world.add(grid);
    selLabelText = ''; syncSelMarker();
    if (legend) {
      legend.querySelector('[data-c="w"]').style.background = css(p.warm);
      legend.querySelector('[data-c="c"]').style.background = css(p.cool);
      legend.querySelector('[data-c="n"]').style.background = css(p.neutral);
    }
  }

  function syncFloor() {
    const n = Math.min(MAXU, st.charges.length);
    for (let i = 0; i < MAXU; i++) {
      const c = st.charges[i];
      if (c && i < n) uC[i].set(c.x, c.y, c.z, c.q); else uC[i].set(0, 0, 0, 0);
    }
    floorMat.uniforms.uCount.value = n;
  }

  const _o = new THREE.Object3D(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // lines fade with height above/below the floor and with distance, so the plane of the charges stays the focus
  const fadeAt = (x, y, z) => (1 - 0.7 * ss(2.5, 12, Math.abs(y))) * (1 - ss(16, R_DRAW, Math.hypot(x, y, z)));
  // ΔV per scene: |E| median over a ring zone 1.5–4.5 cm around the charges, × 0.36 cm, nearest 1-2-5 value
  // (keeps the dipole at 50 kV like before); the plates demo uses 500 kV (~7 contours across the gap)
  function contourStep() {
    if (st.locked) return DV_PLATES;
    if (!st.charges.length) return 5e4;
    const E = [];
    for (let x = -HALF; x <= HALF; x += 0.5) for (let z = -HALF; z <= HALF; z += 0.5) {
      let dmin = Infinity;
      for (const c of st.charges) dmin = Math.min(dmin, Math.hypot(x - c.x, c.y, z - c.z));
      if (dmin < 1.5 || dmin > 4.5) continue;
      E.push(EField.fieldInto(st.charges, x, 0, z, ebuf));
    }
    if (!E.length) return 5e4;
    E.sort((a, b) => a - b);
    const t = E[E.length >> 1] * 0.0036;
    let best = LADDER[0];
    for (const v of LADDER) if (Math.abs(Math.log(v / t)) < Math.abs(Math.log(best / t))) best = v;
    return best;
  }
  const dvStr = v => v >= 1e6 ? (v / 1e6) + ' MV' : v >= 1e3 ? (v / 1e3) + ' kV' : v + ' V';
  function syncStep() {
    st.dv = contourStep(); floorMat.uniforms.uStep.value = st.dv / KV;
    if (dvEl) dvEl.textContent = dvStr(st.dv);
  }

  // arrowheads: candidates from the last build; the ones pointing (almost) at the camera look like dots
  // on screen, so they are skipped and re-filtered when the camera moves
  let arrowData = new Float32Array(0), arrowN = 0;
  const camL = new THREE.Vector3(), lastCam = new THREE.Vector3(1e9, 0, 0);
  function facing(i) {
    const px = arrowData[6 * i], py = arrowData[6 * i + 1], pz = arrowData[6 * i + 2];
    let vx = px - camL.x, vy = py - camL.y, vz = pz - camL.z; const m = Math.hypot(vx, vy, vz) || 1;
    return Math.abs((vx * arrowData[6 * i + 3] + vy * arrowData[6 * i + 4] + vz * arrowData[6 * i + 5]) / m) > 0.9;
  }
  function placeArrows() {
    camL.copy(camera.position); world.worldToLocal(camL); lastCam.copy(camL);
    let na = 0;
    for (let i = 0; i < arrowN && na < MAXA; i++) {
      if (facing(i)) continue;
      _d.set(arrowData[6 * i + 3], arrowData[6 * i + 4], arrowData[6 * i + 5]);
      _o.position.set(arrowData[6 * i], arrowData[6 * i + 1], arrowData[6 * i + 2]); _o.quaternion.setFromUnitVectors(_up, _d); _o.scale.setScalar(1); _o.updateMatrix();
      arrows.setMatrixAt(na++, _o.matrix);
    }
    arrows.count = na; arrows.instanceMatrix.needsUpdate = true;
  }
  function buildLines(fast) {
    let sp = 0, sn = 0;
    st.charges.forEach(c => { if (c.q > 0) sp += c.q; else sn -= c.q; });
    const o = Object.assign({}, fast ? FAST : FULL), tot = Math.max(sp, sn);
    if (tot > 0) o.perUnitCharge = Math.min(o.perUnitCharge, (fast ? FAST_MAX : FULL_MAX) / tot);
    traced = st.charges.length ? EField.traceLines(st.charges, o) : [];
    const R2 = R_DRAW * R_DRAW, segs = [], cols = [], P = pal(), lc = new THREE.Color(P.line);
    const ad = [];
    const nearCharge = (x, y, z) => st.charges.some(c => (x - c.x) ** 2 + (y - c.y) ** 2 + (z - c.z) ** 2 < (radius(c.q) + 0.5) ** 2);
    for (const L of traced) {
      const p = L.points, n = p.length / 3;
      const sgn = st.charges[L.from].q > 0 ? 1 : -1;     // lines traced from − run against E
      let arc = 0, next = 1.8;
      for (let i = 0; i < n - 1; i++) {
        const ax = p[3 * i], ay = p[3 * i + 1], az = p[3 * i + 2], bx = p[3 * i + 3], by = p[3 * i + 4], bz = p[3 * i + 5];
        const ds = Math.hypot(bx - ax, by - ay, bz - az);
        arc += ds;
        if (ax * ax + ay * ay + az * az > R2 || bx * bx + by * by + bz * bz > R2) continue;
        const fa = fadeAt(ax, ay, az), fb = fadeAt(bx, by, bz);
        segs.push(ax, ay, az, bx, by, bz);
        cols.push(lc.r, lc.g, lc.b, P.lineA * fa, lc.r, lc.g, lc.b, P.lineA * fb);
        if (arc >= next && ds > 0) {
          next = arc + 5.5;
          if (fb > 0.5 && !nearCharge(bx, by, bz)) {
            _d.set((bx - ax) * sgn, (by - ay) * sgn, (bz - az) * sgn).normalize();
            ad.push(bx, by, bz, _d.x, _d.y, _d.z);
          }
        }
      }
    }
    lines.geometry.dispose();
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 4));
    lines.geometry = g;
    arrowData = new Float32Array(ad); arrowN = ad.length / 6; placeArrows();
    lines.visible = arrows.visible = st.showLines;
  }

  /* ── state changes ── */
  function changed(cont) {
    syncCharges(); syncFloor(); readProbe(); syncSelUI();
    if (cont) { dirtyFast = true; lastCont = performance.now(); fullDone = false; }
    else { fullBuild(); }
  }
  function fullBuild() { buildLines(false); syncStep(); fullDone = true; dirtyFast = false; }
  const snap = v => Math.max(-PLACE, Math.min(PLACE, Math.round(v / SNAP) * SNAP));
  const inFloor = p => Math.abs(p.x) <= HALF && Math.abs(p.z) <= HALF;
  function nearest(x, z, r, skip) {
    let best = -1, bd = r * r;
    st.charges.forEach((c, i) => { if (i === skip) return; const d = (c.x - x) ** 2 + (c.z - z) ** 2; if (d <= bd) { bd = d; best = i; } });
    return best;
  }
  function lockedSay() { say('ฉากนี้เป็นฉากสาธิต กด ล้างฉาก ก่อนวางหรือย้ายประจุ', true); }
  function addCharge(x, z, sign) {
    if (st.locked) { lockedSay(); return false; }
    x = snap(x); z = snap(z);
    const hit = nearest(x, z, 1.2);
    if (hit >= 0) { select(hit); return false; }
    if (st.charges.length >= MAXN) { say(`วางประจุได้สูงสุด ${MAXN} ประจุ — ลบประจุที่เลือกหรือล้างฉากก่อน`, true); return false; }
    st.charges.push({ x, y: 0, z, q: sign * QDEF }); st.sel = st.charges.length - 1;
    changed(false); say(''); return true;
  }
  function moveCharge(i, x, z, cont) {
    const c = st.charges[i]; if (!c || st.locked) return;
    x = snap(x); z = snap(z);
    if (x === c.x && z === c.z) return;
    if (nearest(x, z, 0.8, i) >= 0) return;          // don't stack charges on top of each other
    c.x = x; c.z = z; changed(cont);
  }
  function removeSel() {
    if (st.sel < 0 || st.locked) return;
    st.charges.splice(st.sel, 1); st.sel = -1; changed(false);
  }
  function select(i) { st.sel = !st.locked && i >= 0 && i < st.charges.length ? i : -1; syncSelMarker(); syncSelUI(); }
  function setQ(i, q) {
    const c = st.charges[i]; if (!c || st.locked || c.q === q) return;
    c.q = q; changed(true);
  }
  const PRESETS = {
    dipole: () => [{ x: -5, z: 0, q: 2 }, { x: 5, z: 0, q: -2 }],
    pp: () => [{ x: -5, z: 0, q: 2 }, { x: 5, z: 0, q: 2 }],
    // two vertical sheets (normal along z) of 5 × 3 charges, 1.5 cm apart, gap 4 cm; the floor cuts the middle row
    plates: () => { const a = []; [[-2, 0.4], [2, -0.4]].forEach(([z, q]) => { for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) a.push({ x: 1.5 * i, y: 1.5 * j, z, q }); }); return a; },
    clear: () => []
  };
  function preset(name) {
    if (!PRESETS[name]) return;
    st.locked = name === 'plates';
    st.charges = PRESETS[name]().map(c => ({ x: c.x, y: c.y || 0, z: c.z, q: c.q }));
    st.sel = -1; stopTest(); changed(false);
    if (st.locked) { st.probe = { x: 0, z: 0 }; readProbe(); }
    syncLock(); say('');
  }
  function syncLock() {
    setView(st.locked ? 'plates' : 'wide');
    if (lockNote) lockNote.style.display = st.locked ? '' : 'none';
    if (modeBox) modeBox.querySelectorAll('button[data-v="pos"], button[data-v="neg"]').forEach(b => { b.disabled = st.locked; });
    if (st.locked && (st.mode === 'pos' || st.mode === 'neg') && modeBox) modeBox.querySelector('button[data-v="probe"]').click();
  }

  /* ── probe readout ── */
  const pStr = v => (v < -1e-9 ? '−' : '') + Math.abs(v).toFixed(1);
  const sgnSci = (v, d) => { const t = sci(v, d); return t.charAt(0) === '-' ? '−' + t.slice(1) : t; };
  function qStr(q) { return (q > 0 ? '+' : q < 0 ? '−' : '') + Math.abs(q).toFixed(1) + ' µC'; }
  let RO = null, lastRead = { E: null, V: null };
  function readProbe() {
    const x = st.probe.x, z = st.probe.z, p = { x, y: 0, z };
    probeDot.position.set(x, 0.12, z);
    let E = 0, V = 0, onCharge = false;
    if (st.charges.length) {
      if (EField.isWithin(p, st.charges, EField.R_MIN)) onCharge = true;
      else { E = EField.fieldInto(st.charges, x, 0, z, ebuf); V = EField.potential(st.charges, p); }
    }
    const ok = !onCharge && isFinite(E) && isFinite(V);
    if (ok && E > 0) { _d.set(ebuf[0], ebuf[1], ebuf[2]).normalize(); probeArrow.setDirection(_d); probeArrow.position.set(x, 0.12, z); probeArrow.visible = true; }
    else probeArrow.visible = false;
    lastRead = ok ? { E, V, Ex: ebuf[0], Ez: ebuf[2] } : { E: null, V: null, Ex: null, Ez: null };
    if (RO) {
      RO.P.textContent = `(${pStr(x)}, ${pStr(z)}) cm`;
      RO.E.textContent = ok ? sgnSci(E, 2) + ' N/C' : '—';
      RO.V.textContent = ok ? sgnSci(V, 2) + ' V' : '—';
      if (onCharge) { say('จุดวัดอยู่ที่ตัวประจุพอดี: สนามและศักย์ของประจุจุดไม่นิยามที่ตำแหน่งนี้', false, true); onChargeMsg = true; }
      else if (onChargeMsg) { onChargeMsg = false; say(''); }
    }
    return lastRead;
  }
  function setProbe(p) { st.probe = { x: Math.max(-HALF, Math.min(HALF, p.x)), z: Math.max(-HALF, Math.min(HALF, p.z)) }; readProbe(); }

  /* ── test charge ── */
  function releaseTest(x, z) {
    tc.active = true; tc.x = x; tc.z = z; tc.vx = 0; tc.vz = 0; tc.n = 0; tc.why = '';
    tcMesh.visible = true; tcMesh.position.set(x, 0, z); tg.setDrawRange(0, 0);
  }
  function stopTest() { tc.active = false; tcMesh.visible = false; tg.setDrawRange(0, 0); tc.n = 0; }
  function stepTest(dt) {
    if (!tc.active || !st.play || !st.charges.length) return;
    const steps = Math.min(16, Math.ceil(dt / (1 / 240))), h = dt / steps;
    for (let k = 0; k < steps; k++) {
      EField.fieldInto(st.charges, tc.x, 0, tc.z, ebuf);
      tc.vx += G_ACC * ebuf[0] * h; tc.vz += G_ACC * ebuf[2] * h;
      const damp = Math.max(0, 1 - DAMP * h); tc.vx *= damp; tc.vz *= damp;
      const sp = Math.hypot(tc.vx, tc.vz); if (sp > VMAX) { tc.vx *= VMAX / sp; tc.vz *= VMAX / sp; }
      tc.x += tc.vx * h; tc.z += tc.vz * h;
      const hit = st.charges.findIndex(c => (c.x - tc.x) ** 2 + c.y * c.y + (c.z - tc.z) ** 2 < radius(c.q) ** 2);
      if (hit >= 0) { tc.active = false; tc.why = 'charge'; break; }
      if (Math.abs(tc.x) > HALF || Math.abs(tc.z) > HALF) { tc.active = false; tc.why = 'edge'; tcMesh.visible = false; break; }
    }
    tcMesh.position.set(tc.x, 0, tc.z);
    if (tc.n < TN) { tp[tc.n * 3] = tc.x; tp[tc.n * 3 + 1] = 0.06; tp[tc.n * 3 + 2] = tc.z; tc.n++; tg.attributes.position.needsUpdate = true; tg.setDrawRange(0, tc.n); }
  }

  /* ── panel ── */
  U.head('ห้องทดลองสนามไฟฟ้า', 'ประจุจุดบนพื้นราบ · 1 หน่วยฉาก = 1 cm · ประจุเป็น µC · k = 9.0 × 10⁹ N·m²/C²');
  U.group('แตะ / คลิกที่พื้นเพื่อ');
  const modeBox = U.seg({ value: st.mode, options: [['probe', 'วัดค่า'], ['pos', 'วาง +'], ['neg', 'วาง −'], ['test', 'ประจุทดสอบ']] }, v => { st.mode = v; if (uiReady) say(''); });
  modeBox.classList.add('ef-mode');
  const msg = U.html('<div class="ef-msg" role="status" aria-live="polite"></div>');
  const HINT = {
    probe: 'ชี้หรือแตะพื้นเพื่ออ่าน |E| และ V · ลากลูกประจุเพื่อย้าย · แตะลูกประจุเพื่อเลือก',
    pos: 'แตะพื้นเพื่อวางประจุบวก (+2 µC) · ลากลูกประจุเพื่อย้าย',
    neg: 'แตะพื้นเพื่อวางประจุลบ (−2 µC) · ลากลูกประจุเพื่อย้าย',
    test: 'แตะพื้นเพื่อปล่อยประจุทดสอบ (บวก) แล้วดูว่าแรง F = qE พามันไปทางไหน'
  };
  function say(t, warn, sticky) {
    clearTimeout(msgTimer);
    msg.textContent = t || HINT[st.mode]; msg.classList.toggle('warn', !!warn);
    if (t && !sticky) msgTimer = setTimeout(() => { msg.textContent = HINT[st.mode]; msg.classList.remove('warn'); }, warn ? 6000 : 9000);
  }

  U.group('ประจุที่เลือก');
  const selInfo = U.html('<div class="ef-sel"></div>');
  const qSlider = U.slider({ label: 'ค่าประจุ q', min: -5, max: 5, step: 0.5, value: QDEF, fmt: qStr }, x => { if (uiReady && st.sel >= 0) setQ(st.sel, x); });
  const delBox = U.html('<div class="chips"><button class="ef-del">ลบประจุที่เลือก</button></div>');
  const delBtn = delBox.querySelector('button');
  delBtn.onclick = removeSel;
  function syncSelUI() {
    const c = st.charges[st.sel];
    qSlider.disabled = !c; delBtn.disabled = !c;
    selInfo.innerHTML = c ? `ประจุที่ ${st.sel + 1} <span class="mono">${qStr(c.q)}</span> ที่ <span class="mono">(${pStr(c.x)}, ${pStr(c.z)}) cm</span>`
      : st.locked ? 'ฉากสาธิต: เลือกหรือแก้ประจุไม่ได้' : 'ยังไม่ได้เลือก · แตะที่ลูกประจุเพื่อเลือก';
    if (c && parseFloat(qSlider.value) !== c.q) qSlider.setValue(c.q);
  }

  U.group('ฉากตัวอย่าง');
  const lockNote = U.note(LOCK_NOTE); lockNote.classList.add('ef-lock'); lockNote.style.display = 'none';
  const pBox = U.html('<div class="chips ef-presets"><button data-p="dipole">ไดโพล (+ −)</button><button data-p="pp">คู่ + +</button><button data-p="plates">แผ่นขนาน</button><button data-p="clear">ล้างฉาก</button></div>');
  pBox.onclick = e => { const b = e.target.closest('button'); if (b) preset(b.dataset.p); };

  U.group('แสดงผล');
  U.check('เส้นสนามไฟฟ้า (หัวลูกศรบอกทิศ E)', st.showLines, v => { st.showLines = v; lines.visible = arrows.visible = v; });
  U.check('พื้นศักย์ (สีและเส้นศักย์เท่า)', st.showFloor, v => { st.showFloor = v; floor.visible = v; if (grid) grid.visible = !v; });
  const legend = U.html('<div class="legend ef-legend"><span><i data-c="w"></i>V บวก</span><span><i data-c="c"></i>V ลบ</span><span><i data-c="n" style="box-shadow:inset 0 0 0 1px var(--line)"></i>V ≈ 0</span><span><i style="background:#1c9a5a"></i>ทิศ E ที่จุดวัด</span></div>');

  RO = U.readouts('ค่าที่จุดวัด', [['P', 'ตำแหน่ง (x, z)'], ['E', 'ขนาดสนาม |E|'], ['V', 'ศักย์ไฟฟ้า V']]);
  const floorNote = U.note('สีพื้นบอกศักย์ V บนระนาบของประจุ: โทนอุ่น = บวก โทนเย็น = ลบ (ใกล้ประจุสีถูกจำกัดไว้ไม่ให้เข้มจนเละ) · เส้นบนพื้นคือ<b>เส้นศักย์เท่า ห่างกันทีละ ΔV = <span class="mono ef-dv"></span> เท่ากันทุกเส้น</b> (เลือกค่าให้อ่านง่ายในแต่ละฉาก จากชุด 1, 2, 5 × 10ⁿ V) เส้นยิ่งชิดแปลว่าสนามยิ่งแรง และตั้งฉากกับเส้นสนามที่วิ่งบนพื้น (ตรงที่เส้นถี่เกินกว่าจะแยกออก เส้นจะจางไป) · จำนวนเส้นสนามที่ออกจากประจุแปรตาม |q| เริ่มที่ + และจบที่ − (บางเส้นวิ่งออกไปไกลนอกจอ)');
  const dvEl = floorNote.querySelector('.ef-dv');
  U.note('ประจุทดสอบเป็น<b>ภาพเชิงคุณภาพ</b>: เราใส่แรงหน่วงให้มันไหลไปตามแรง F = qE อย่างช้า ๆ ส่วนประจุจริงมีความเฉื่อย (มวล) จึงไม่จำเป็นต้องเดินตามเส้นสนามพอดี โดยเฉพาะตรงที่เส้นโค้งมาก');

  const hintEl = stage && stage.querySelector('.sim-hint');
  if (hintEl) hintEl.textContent = 'ลากลูกประจุ: ย้าย · ลากพื้น: หมุน · ล้อเมาส์ / สองนิ้ว: ซูม';

  /* ── pointer: place / select / drag / probe ── */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hv = new THREE.Vector3();
  function floorAt(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hv)) return null;
    world.worldToLocal(hv); return { x: hv.x, z: hv.z };
  }
  // which charge is under the pointer: raycast the spheres, then a pixel slop (22 px on touch / coarse pointers)
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const _s = new THREE.Vector3();
  function pickAt(cx, cy, type) {
    if (st.locked) return -1;
    const r = canvas.getBoundingClientRect();
    ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(objs.map(o => o.ball), false);
    if (hits.length) return objs.findIndex(o => o.ball === hits[0].object);
    const slop = type !== 'mouse' || coarse ? 22 : 6;
    let best = -1, bd = Infinity;
    st.charges.forEach((c, i) => {
      _s.set(c.x, c.y, c.z); world.localToWorld(_s).project(camera);
      if (_s.z > 1) return;
      const d = Math.hypot(r.left + (_s.x + 1) / 2 * r.width - cx, r.top + (1 - _s.y) / 2 * r.height - cy);
      if (d <= slop && d < bd) { bd = d; best = i; }
    });
    return best;
  }
  let drag = null, down = null;
  function endDrag() {
    if (!drag) return;
    const d = drag; drag = null; controls.enabled = true;
    try { if (canvas.hasPointerCapture && canvas.hasPointerCapture(d.id)) canvas.releasePointerCapture(d.id); } catch (err) {}
    if (!fullDone) fullBuild();
  }
  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (drag) return;                                  // ignore a second finger while dragging
    const i = pickAt(e.clientX, e.clientY, e.pointerType);
    if (i >= 0) {
      controls.enabled = false;                        // runs before OrbitControls (capture phase)
      drag = { i, id: e.pointerId };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      select(i); e.preventDefault();
      return;
    }
    down = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }
  function onMove(e) {
    if (drag) { if (e.pointerId === drag.id) { const p = floorAt(e); if (p) moveCharge(drag.i, p.x, p.z, true); } return; }
    if (e.pointerType === 'mouse' && e.buttons === 0) { const p = floorAt(e); if (p && inFloor(p)) setProbe(p); }
  }
  function onUp(e) {
    if (drag) { if (e.pointerId === drag.id) endDrag(); return; }
    if (!down || e.pointerId !== down.id) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6; down = null;
    if (moved) return;
    const p = floorAt(e); if (!p || !inFloor(p)) return;
    clickFloor(p);
  }
  function clickFloor(p) {
    if (st.mode === 'pos' || st.mode === 'neg') addCharge(p.x, p.z, st.mode === 'pos' ? 1 : -1);
    else if (st.mode === 'test') { setProbe(p); releaseTest(p.x, p.z); }
    else { setProbe(p); select(-1); }
  }
  const onCancel = e => { if (drag && e.pointerId === drag.id) endDrag(); if (down && e.pointerId === down.id) down = null; };
  const onLeave = e => { if (drag && e.pointerId === drag.id && !(canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId))) endDrag(); };
  const onBlur = () => endDrag();
  canvas.addEventListener('pointerdown', onDown, true);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('lostpointercapture', onCancel);
  canvas.addEventListener('pointerleave', onLeave);
  window.addEventListener('blur', onBlur);
  window.addEventListener('themechange', applyTheme);

  /* ── start ── */
  applyTheme();
  if (saved) { changed(false); syncLock(); } else preset('dipole');
  uiReady = true;
  readProbe(); syncSelUI(); say('');
  built = true;

  host.onUpdate(dt => {
    frames++;
    if (dirtyFast) { buildLines(true); dirtyFast = false; }
    else if (!fullDone && !drag && performance.now() - lastCont > 160) fullBuild();
    stepTest(dt);
    // re-filter camera-facing arrowheads when the view has moved (at most every 4th frame)
    if (arrowN && st.showLines && (frames & 3) === 0) {
      camL.copy(camera.position); world.worldToLocal(camL);
      if (camL.distanceToSquared(lastCam) > 0.05) placeArrows();
    }
  });

  /* ── test hook ── */
  const project = (x, z, y) => {
    const v = world.localToWorld(new THREE.Vector3(x, y || 0, z)).project(camera), r = canvas.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, ndc: v };
  };
  // render only the floor (contours on/off) to a render target and read the pixels at floor points
  function floorRead(pts, contours) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y);
    const hide = [lines, arrows, chargeGroup, plateGroup, ring, probeArrow, probeDot, tcMesh, trail, grid, selLabel].filter(Boolean);
    const vis = hide.map(o => o.visible); hide.forEach(o => { o.visible = false; });
    const fv = floor.visible; floor.visible = true; floorMat.uniforms.uContour.value = contours ? 1 : 0;
    renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null);
    const buf = new Uint8Array(4), out = [];
    for (const [x, z] of pts) {
      const v = world.localToWorld(new THREE.Vector3(x, 0, z)).project(camera);
      if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1) { out.push(null); continue; }
      const px = Math.min(size.x - 1, Math.round((v.x + 1) / 2 * size.x)), py = Math.min(size.y - 1, Math.round((v.y + 1) / 2 * size.y));
      renderer.readRenderTargetPixels(rt, px, py, 1, 1, buf); out.push([buf[0], buf[1], buf[2]]);
    }
    hide.forEach((o, k) => { o.visible = vis[k]; }); floor.visible = fv; floorMat.uniforms.uContour.value = 1;
    rt.dispose();
    return out;
  }
  const hook = window.__ef = {
    ready: () => built,
    charges: () => st.charges.map(c => ({ x: c.x, y: c.y, z: c.z, q: c.q })),
    locked: () => st.locked,
    plateNormal: () => [0, 1],                         // plates demo: sheets at z = ∓2, normal along +z
    contourStep: () => st.dv,
    pickAt: (x, y, type) => pickAt(x, y, type),
    setCamera(x, y, z) { camera.position.set(x, y, z); controls.update(); },
    arrowStats() {
      camL.copy(camera.position); world.worldToLocal(camL);
      const m = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
      let face = 0;
      for (let i = 0; i < arrows.count; i++) {
        arrows.getMatrixAt(i, m); m.decompose(pos, q, sc);
        const d = _up.clone().applyQuaternion(q), v = pos.clone().sub(camL).normalize();
        if (Math.abs(d.dot(v)) > 0.92) face++;
      }
      return { all: arrowN, shown: arrows.count, facing: face };
    },
    _arrows: () => arrows,
    floorLine(x0, z0, x1, z1, n) {
      const pts = []; for (let k = 0; k < n; k++) { const t = k / (n - 1); pts.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]); }
      return { on: floorRead(pts, true), off: floorRead(pts, false) };
    },
    lines: () => traced.map(L => { const p = L.points, n = p.length; return { from: L.from, to: L.to, n: n / 3, first: [p[0], p[1], p[2]], last: [p[n - 3], p[n - 2], p[n - 1]] }; }),
    readout(x, z) { setProbe({ x, z }); return Object.assign({}, lastRead); },
    place: (x, z, sign) => addCharge(x, z, sign < 0 ? -1 : 1),
    select: i => select(i),
    selected: () => st.sel,
    setQ(i, q) { select(i); if (st.sel === i) { qSlider.setValue(q); fullBuild(); } },
    preset: name => preset(name),
    drag(i, x, z) { if (st.locked) return; select(i); moveCharge(i, x, z, true); fullBuild(); },
    testCharge: (x, z) => releaseTest(x, z),
    testState: () => ({ active: tc.active, x: tc.x, z: tc.z, why: tc.why }),
    dragging: () => !!drag,
    controlsEnabled: () => controls.enabled,
    frames: () => frames,
    screenOf(i) { const c = st.charges[i]; return c ? project(c.x, c.z, c.y) : null; },
    screenOfPoint: (x, z) => project(x, z),
    floorColors: () => [hex(pal().neutral), hex(pal().warm), hex(pal().cool), floorMat.uniforms.uNeutral.value.getHexString()],
    floorPixel(x, z) { const r = floorRead([[x, z]], false)[0]; return r; }
  };

  return {
    toggle() { st.play = !st.play; return st.play; },
    dispose() {
      fullDone = true; dirtyFast = false; endDrag(); clearTimeout(msgTimer);   // no full re-trace while leaving
      canvas.removeEventListener('pointerdown', onDown, true);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('lostpointercapture', onCancel);
      canvas.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('themechange', applyTheme);
      simEField.saved = { charges: st.charges.map(c => ({ x: c.x, y: c.y, z: c.z, q: c.q })), locked: st.locked, sel: st.sel, mode: st.mode, showLines: st.showLines, showFloor: st.showFloor, probe: { x: st.probe.x, z: st.probe.z } };
      // everything still in the scene is freed by host.dispose(); free what may not be attached
      Object.values(glyphs).forEach(t => t.dispose());
      arrows.dispose(); ballGeo.dispose(); coneGeo.dispose(); lines.geometry.dispose(); tg.dispose();
      if (window.__ef === hook) delete window.__ef;
    }
  };
}
