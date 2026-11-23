/* ─────────── Sim : circuit lab (บทที่ 05 ไฟฟ้ากระแสและวงจร) ───────────
   Prebuilt circuits (spec §6.3, approach ข). Every current and potential comes from Circuit (circuit-core.js):
   Circuit.solve for the DC scenes, Circuit.rcState / Circuit.tau for the RC run. Nothing here re-derives them.
   • Wires lie on the floor plane (x, z = schematic X, −Y). A wire's height is its potential: y = KH·V, with
     V = 0 at the battery's negative pole (the floor grid sits a little lower, at FLOOR).
   • Charge markers (positive charge, conventional current) are evenly spaced along every wire and move at K·I,
     so the number passing a point per second ∝ I and the branch rates add up at a junction. K is one number for
     the whole circuit (lowered when the fastest marker would pass VMAX), so speed ratios equal current ratios.
   • Resistor glow ∝ P = I²R on a fixed per-scene scale (twice the hottest resistor at the scene's defaults).
   • RC: the clock runs at τ/3 s of circuit time per real second (τ ≈ 3 s on screen); any value change restarts it.
   Debug/test hook: window.__ck. */
function simCircuit(host, U) {
  const { world, camera, renderer, controls, scene } = host;
  const canvas = renderer.domElement, stage = canvas.parentElement;
  const aspect = stage && stage.clientHeight ? stage.clientWidth / stage.clientHeight : 1.4;
  const far = Math.min(1.9, Math.max(1, 1.25 / aspect));          // portrait stages (phones): back the camera off
  // frame a circuit from its width (two-loop and RC reach x = −7): centred on it, backed off for wider ones
  function frame(lay) {
    let lo = Infinity, hi = -Infinity;
    lay.forEach(e => e.pts.forEach(p => { lo = Math.min(lo, p[0]); hi = Math.max(hi, p[0]); }));
    const cx = (lo + hi) / 2, k = far * ((hi - lo) / 2 + 2) / 8;
    host.setHome(new THREE.Vector3(cx, 2 + 9.5 * k, 0.6 + 14 * k), new THREE.Vector3(cx, 2, 0.6));
  }

  const KH = 0.25, FLOOR = -0.35, SP = 0.75, VREF = 2.2, VMAX = 6, T_SCREEN = 3, T_END = 6, WR = 0.055;
  const RANGE = { eps: [1, 24], eps2: [1, 24], r: [Circuit.R_INTERNAL_MIN, 5], R1: [1, 1000], R2: [1, 1000], R3: [1, 1000], C: [1e-5, 1e-2] };
  const KIND = { eps: 'emf', eps2: 'emf', r: 'res', r2: 'res', R1: 'res', R2: 'res', R3: 'res', C: 'cap' };
  const NAME = { R1: 'R₁', R2: 'R₂', R3: 'R₃', eps: 'ε', r: 'r', eps2: 'ε₂', r2: 'r₂', C: 'C' };
  const ORDER = ['R1', 'R2', 'R3', 'eps', 'r', 'eps2', 'r2', 'C'];
  const VIS = { single: ['eps', 'r', 'R1'], series: ['eps', 'r', 'R1', 'R2', 'R3'], parallel: ['eps', 'r', 'R1', 'R2', 'R3'],
    mixed: ['eps', 'r', 'R1', 'R2', 'R3'], twoloop: ['eps', 'eps2', 'r', 'R1', 'R2', 'R3'], rc: ['eps', 'r', 'R1', 'C'] };
  const DESC = {
    single: 'แบตเตอรี่ (ε, r) ต่อกับตัวต้านทาน R ตัวเดียว: I = ε / (R + r)',
    series: 'R₁ R₂ R₃ ต่ออนุกรม: กระแสเท่ากันทุกตัว ศักย์ตกคร่อมแต่ละตัวตามค่า R (V = IR)',
    parallel: 'R₁ R₂ R₃ ต่อขนาน: ความต่างศักย์คร่อมเท่ากันทุกตัว กระแสแยกตาม 1/R แล้วรวมกลับที่จุดต่อ',
    mixed: 'R₁ อนุกรมกับ (R₂ ขนาน R₃): กระแสทั้งหมดผ่าน R₁ แล้วแยกเข้า R₂ กับ R₃',
    twoloop: 'แบตเตอรี่ ε (ซ้าย) และ ε₂ (ขวา) มีความต้านทานภายใน r เท่ากัน ต่อผ่าน R₁ และ R₂ มาที่จุดต่อเดียวกัน แล้วกระแสรวมไหลผ่าน R₃ · ลองลด ε₂ จนกระแสในแบตเตอรี่ ε₂ ไหลย้อน',
    rc: 'ชาร์จ: แบตเตอรี่ (ε, r) ประจุตัวเก็บประจุ C ผ่าน R, τ = (R + r)C · คายประจุ: สับสวิตช์ตัดแบตเตอรี่ออก C คายผ่าน R อย่างเดียว, τ = RC'
  };

  /* ── layouts: schematic coordinates (X right, Y up), floor x = X, z = −Y ──
     W(node, polyline, current along it) · E(element, a-end, b-end, node a, node b); element current is a → b */
  const W = (node, pts, cur) => ({ kind: 'wire', node, pts, cur });
  const E = (id, A, B, na, nb) => ({ kind: 'elem', id, pts: [A, B], na, nb });
  const battCol = (X, id, rid, n0, n1, n2) => {
    const c = I => I[id];
    return [W(n0, [[X, -4], [X, -2.2]], c), E(id, [X, -2.2], [X, 0.3], n0, n1), W(n1, [[X, 0.3], [X, 0.8]], c),
      E(rid, [X, 0.8], [X, 2.2], n1, n2), W(n2, [[X, 2.2], [X, 4]], c)];
  };
  const column = (X, id, nt, nb) => [W(nt, [[X, 4], [X, 1.5]], I => I[id]), E(id, [X, 1.5], [X, -1.5], nt, nb), W(nb, [[X, -1.5], [X, -4]], I => I[id])];
  const LAYOUT = {
    single: () => [...battCol(-6, 'eps', 'r', 0, 1, 2),
      W(2, [[-6, 4], [-1.5, 4]], I => I.R1), E('R1', [-1.5, 4], [1.5, 4], 2, 0), W(0, [[1.5, 4], [6, 4], [6, -4], [-6, -4]], I => I.R1)],
    series: () => [...battCol(-6, 'eps', 'r', 0, 1, 2),
      W(2, [[-6, 4], [-4.5, 4]], I => I.R1), E('R1', [-4.5, 4], [-1.5, 4], 2, 3),
      W(3, [[-1.5, 4], [1.5, 4]], I => I.R2), E('R2', [1.5, 4], [4.5, 4], 3, 4),
      W(4, [[4.5, 4], [6, 4], [6, 1.5]], I => I.R3), E('R3', [6, 1.5], [6, -1.5], 4, 0),
      W(0, [[6, -1.5], [6, -4], [-6, -4]], I => I.R3)],
    parallel: () => [...battCol(-6, 'eps', 'r', 0, 1, 2),
      W(2, [[-6, 4], [-1.5, 4]], I => I.eps), W(2, [[-1.5, 4], [2, 4]], I => I.R2 + I.R3), W(2, [[2, 4], [5.5, 4]], I => I.R3),
      ...column(-1.5, 'R1', 2, 0), ...column(2, 'R2', 2, 0), ...column(5.5, 'R3', 2, 0),
      W(0, [[5.5, -4], [2, -4]], I => I.R3), W(0, [[2, -4], [-1.5, -4]], I => I.R2 + I.R3), W(0, [[-1.5, -4], [-6, -4]], I => I.eps)],
    mixed: () => [...battCol(-6, 'eps', 'r', 0, 1, 2),
      W(2, [[-6, 4], [-4.5, 4]], I => I.R1), E('R1', [-4.5, 4], [-1.5, 4], 2, 3),
      W(3, [[-1.5, 4], [1.5, 4]], I => I.R1), W(3, [[1.5, 4], [5.5, 4]], I => I.R3),
      ...column(1.5, 'R2', 3, 0), ...column(5.5, 'R3', 3, 0),
      W(0, [[5.5, -4], [1.5, -4]], I => I.R3), W(0, [[1.5, -4], [-6, -4]], I => I.R2 + I.R3)],
    twoloop: () => [...battCol(-7, 'eps', 'r', 0, 2, 3),
      W(3, [[-7, 4], [-5, 4]], I => I.R1), E('R1', [-5, 4], [-2, 4], 3, 1), W(1, [[-2, 4], [0, 4]], I => I.R1),
      ...column(0, 'R3', 1, 0),
      W(0, [[0, -4], [-7, -4]], I => I.eps), W(0, [[0, -4], [7, -4]], I => I.eps2),
      ...battCol(7, 'eps2', 'r2', 0, 4, 5),
      W(5, [[7, 4], [5, 4]], I => I.R2), E('R2', [5, 4], [2, 4], 5, 1), W(1, [[2, 4], [0, 4]], I => I.R2)],
    // RC: node 'A' = battery side of the switch, 2 = switch pivot / R's left end, 3 = top plate. The blade joins the
    // pivot to contact A (charge) or to contact B, which is wired to the bottom rail (discharge: battery cut out).
    rc: mode => [...battCol(-7, 'eps', 'r', 0, 1, 'A'),
      W('A', [[-7, 4], [-4.6, 4]], I => I.eps),
      mode === 'charge' ? W(2, [[-4.6, 4], [-3, 4]], I => I.R1) : W(2, [[-4.6, 2.6], [-3, 4]], I => I.R1),
      W(0, [[-4.6, -4], [-4.6, 2.6]], I => I.sw),
      W(2, [[-3, 4], [-1.5, 4]], I => I.R1), E('R1', [-1.5, 4], [1.5, 4], 2, 3),
      W(3, [[1.5, 4], [6, 4], [6, 0.3]], I => I.C), E('C', [6, 0.3], [6, -0.3], 3, 0),
      W(0, [[6, -0.3], [6, -4], [-4.6, -4]], I => I.C), W(0, [[-4.6, -4], [-7, -4]], I => I.eps)]
  };
  const RC_CONTACTS = [[[-4.6, 4], 'A'], [[-4.6, 2.6], 0], [[-3, 4], 2]];

  // per-scene reference current (marker speed VREF) and power (full glow at 2×) from the scene's defaults
  const REF = {};
  Circuit.SCENES.forEach(id => {
    const d = Circuit.defaults(id), sol = Circuit.solve(id, d);
    let I = 0, P = 0;
    Object.keys(sol.elems).forEach(k => { I = Math.max(I, Math.abs(sol.elems[k].I)); if (KIND[k] === 'res' && k[0] === 'R') P = Math.max(P, sol.elems[k].P); });
    REF[id] = { I, P: 2 * P };
  });

  /* ── state ── */
  const saved = simCircuit.saved || null;
  const st = {
    scene: saved ? saved.scene : 'single',
    p: saved ? Object.assign({}, saved.p) : Circuit.defaults('single'),
    sel: saved ? saved.sel : 'R1',
    showMarkers: saved ? saved.showMarkers : true,
    showHeight: saved ? saved.showHeight : true,
    rc: { mode: saved ? saved.mode : 'charge', t: 0, t0: 0, v0: 0 },
    play: true,
    v: [0], I: {}, el: {}, sum: { Rtotal: null, Itotal: 0, Vterm: 0 }, K: 0, elapsed: 0
  };
  st.rc.v0 = st.p.eps;
  let edges = [], elems = [], frames = 0, built = false, uiReady = false, msgTimer = 0;

  /* ── theme (the app rebuilds the sim on themechange, so colours are read once) ── */
  const PAL = {
    light: { wire: 0x3b4049, res: 0xc2beb4, rIn: 0x8d8579, batt: 0x30343d, battPos: 0xc8442f, hot: 0xff5a14, marker: 0xd8402f,
      plate: 0xa3a8b1, pos: 0xd94a3a, neg: 0x2f6fd1, arrow: 0x7b808a, line: 0x17191e, lineA: 0.13, dropA: 0.2, label: '#17191e', muted: '#656973', sel: 0x566f10 },
    dark: { wire: 0xc3c8d2, res: 0x8f8b83, rIn: 0x66615a, batt: 0x5b606b, battPos: 0xe0614b, hot: 0xff7a2e, marker: 0xff6b55,
      plate: 0x7a808a, pos: 0xff6b5a, neg: 0x5b8ff0, arrow: 0x9b9da6, line: 0xffffff, lineA: 0.12, dropA: 0.2, label: '#ece9e2', muted: '#9b9da6', sel: 0xb4d44a }
  };
  const P = PAL[isDark() ? 'dark' : 'light'];
  const cssVar = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
  const CH = { acc: cssVar('--a9') || '#566f10', muted: cssVar('--muted') || '#656973', line: cssVar('--line') || '#e4e1d9' };

  /* ── resources: everything the lab creates is tracked so dispose() can free it ── */
  const owned = new Set();
  let sceneRes = [];
  const own = (x, perScene) => { owned.add(x); if (perScene) sceneRes.push(x); return x; };
  const label = (text, color, size, perScene) => {
    const s = makeLabel(text, color, size); own(s.material.map, perScene); own(s.material, perScene); return s;
  };
  function glyphTex(ch) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); g.fillStyle = P.label; g.font = '700 56px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ch, 32, 35);
    const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; return own(t);
  }

  const boxGeo = own(new THREE.BoxGeometry(1, 1, 1));
  const cylGeo = own(new THREE.CylinderGeometry(1, 1, 1, 18, 1));
  const ballGeo = own(new THREE.SphereGeometry(0.13, 10, 8));
  const coneGeo = own(new THREE.ConeGeometry(0.14, 0.42, 12));
  const wireMat = own(new THREE.MeshStandardMaterial({ color: P.wire, roughness: 0.5, metalness: 0.2 }));
  const markerMat = own(new THREE.MeshStandardMaterial({ color: P.marker, emissive: P.marker, emissiveIntensity: 0.35, roughness: 0.4 }));
  const battMat = own(new THREE.MeshStandardMaterial({ color: P.batt, roughness: 0.45, metalness: 0.15 }));
  const battPosMat = own(new THREE.MeshStandardMaterial({ color: P.battPos, roughness: 0.45 }));
  const arrowMat = own(new THREE.MeshBasicMaterial({ color: P.arrow }));
  const plateA = own(new THREE.MeshStandardMaterial({ color: P.plate, roughness: 0.4, metalness: 0.3 }));
  const plateB = own(new THREE.MeshStandardMaterial({ color: P.plate, roughness: 0.4, metalness: 0.3 }));
  const plusMat = own(new THREE.SpriteMaterial({ map: glyphTex('+'), transparent: true, depthWrite: false }));
  const minusMat = own(new THREE.SpriteMaterial({ map: glyphTex('−'), transparent: true, depthWrite: false }));
  const shadowMat = own(new THREE.LineBasicMaterial({ color: P.line, transparent: true, opacity: P.lineA }));
  const dropMat = own(new THREE.LineBasicMaterial({ color: P.line, transparent: true, opacity: P.dropA }));

  const MAXW = 64, MAXM = 400;
  const wires = new THREE.InstancedMesh(cylGeo, wireMat, MAXW); wires.count = 0; wires.frustumCulled = false; world.add(wires);
  const markers = new THREE.InstancedMesh(ballGeo, markerMat, MAXM); markers.count = 0; markers.frustumCulled = false; world.add(markers);

  // floor grid + potential ruler (back left): one tick per 4 V, labels every 8 V
  const grid = new THREE.GridHelper(26, 13, gridHex()[0], gridHex()[1]); grid.position.y = FLOOR; own(grid.geometry); own(grid.material); world.add(grid);
  const ruler = new THREE.Group(); world.add(ruler);
  {
    const RX = 7.8, RZ = -5.6, pts = [RX, FLOOR, RZ, RX, 24 * KH + 0.2, RZ];
    for (let v = 0; v <= 24; v += 4) pts.push(RX - 0.35, v * KH, RZ, RX, v * KH, RZ);
    const g = own(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    ruler.add(new THREE.LineSegments(g, own(new THREE.LineBasicMaterial({ color: P.arrow }))));
    [0, 8, 16, 24].forEach(v => { const s = label(v + ' V', P.muted, 0.55); s.position.set(RX + 0.9, v * KH, RZ); ruler.add(s); });
  }

  const selBox = new THREE.LineSegments(own(new THREE.EdgesGeometry(boxGeo)), own(new THREE.LineBasicMaterial({ color: P.sel })));
  selBox.visible = false; scene.add(selBox);

  let sg = new THREE.Group(); world.add(sg);
  let shadow = null, drops = null, dropPts = [], dots = [], segEdge = [];
  // reference direction of a picked wire section (I > 0 along the drawn polyline)
  const selArrow = new THREE.Mesh(coneGeo, own(new THREE.MeshBasicMaterial({ color: P.sel })));
  selArrow.scale.setScalar(1.3); selArrow.visible = false; world.add(selArrow);

  /* ── RC run (Circuit.rcState / Circuit.tau only) ── */
  const tauNow = () => Circuit.tau(st.p, st.rc.mode);
  const rcAt = t => st.rc.mode === 'charge' ? Circuit.rcState(st.p, 'charge', t + st.rc.t0) : Circuit.rcState(st.p, 'discharge', t, st.rc.v0);
  function restartRC(why) {
    st.rc.t = 0; st.rc.t0 = 0; st.rc.v0 = st.p.eps;
    if (why) say('ค่าเปลี่ยน: เริ่มจับเวลาใหม่ที่ t = 0 ' + (st.rc.mode === 'charge' ? '(ตัวเก็บประจุว่าง)' : '(ตัวเก็บประจุเต็ม V_C = ε)'));
  }
  function switchTo(mode) {
    if (mode !== 'charge' && mode !== 'discharge') return;
    if (mode === st.rc.mode) return;
    const vNow = rcAt(st.rc.t).vC;
    st.rc.mode = mode; st.rc.t = 0; st.rc.t0 = 0; st.rc.v0 = vNow;
    // charging resumes from the present V_C: start the charge curve at the moment it had that value
    if (mode === 'charge') st.rc.t0 = -tauNow() * Math.log(Math.max(1e-12, 1 - vNow / st.p.eps));
    if (modeBox) modeBox.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === mode));
    if (st.scene === 'rc') { buildScene(); update(); }
    say(mode === 'charge' ? 'สับสวิตช์ไปที่แบตเตอรี่: ชาร์จต่อจาก V_C ตอนนี้ เริ่มจับเวลาใหม่ที่ t = 0' : 'สับสวิตช์ตัดแบตเตอรี่: ตัวเก็บประจุคายประจุผ่าน R เริ่มจับเวลาใหม่ที่ t = 0');
  }

  /* ── solve: potentials (node → V), element currents and readouts ── */
  function compute() {
    if (st.scene === 'rc') {
      const s = rcAt(st.rc.t), i = s.i, ch = st.rc.mode === 'charge', ib = ch ? i : 0, p = st.p;
      st.v = { 0: 0, 1: p.eps, A: p.eps - ib * p.r, 2: ch ? p.eps - ib * p.r : 0, 3: s.vC };
      st.I = { eps: ib, r: ib, R1: i, C: i, sw: ch ? 0 : i };
      st.el = { eps: { I: ib, V: -p.eps, P: p.eps * ib }, r: { I: ib, V: ib * p.r, P: ib * ib * p.r },
        R1: { I: i, V: i * p.R1, P: i * i * p.R1 }, C: { I: i, V: s.vC, P: s.vC * i } };
      st.sum = { Rtotal: p.R1, Itotal: ib, Vterm: p.eps - ib * p.r };
      st.rcNow = s;
    } else {
      const sol = Circuit.solve(st.scene, st.p);
      st.v = sol.v; st.el = sol.elems; st.I = {};
      Object.keys(sol.elems).forEach(k => { st.I[k] = sol.elems[k].I; });
      st.sum = { Rtotal: sol.Rtotal, Itotal: sol.Itotal, Vterm: sol.Vterm };
    }
    let imax = 0;
    edges.forEach(e => { e.I = e.kind === 'wire' ? e.cur(st.I) : st.I[e.id]; imax = Math.max(imax, Math.abs(e.I)); });
    if (st.scene === 'rc') imax = Math.abs(rcAt(0).i);          // fixed for the run, so markers slow down as i decays
    const k0 = VREF / REF[st.scene].I;
    st.K = imax * k0 > VMAX ? VMAX / imax : k0;
  }
  const H = () => (st.showHeight ? KH : 0);
  const yOf = n => H() * st.v[n];

  /* ── scene build (only when the circuit or the RC switch changes) ── */
  function clearScene() {
    sceneRes.forEach(x => { x.dispose(); owned.delete(x); }); sceneRes = [];
    world.remove(sg); sg = new THREE.Group(); world.add(sg);
    elems = []; dots = []; shadow = drops = null;
  }
  const v3 = (pt, y) => new THREE.Vector3(pt[0], y, -pt[1]);
  function buildScene() {
    clearScene();
    edges = LAYOUT[st.scene](st.rc.mode);
    let nseg = 0, nmk = 0, acc = 0;
    const ends = {}, verts = {};
    const key = pt => pt[0] + ',' + pt[1];
    segEdge = [];
    edges.forEach((e, ei) => {
      e.nodes = e.kind === 'wire' ? e.pts.map(() => e.node) : [e.na, e.nb];
      e.cum = [0]; e.L = 0;
      for (let k = 1; k < e.pts.length; k++) e.cum.push(e.L += Math.hypot(e.pts[k][0] - e.pts[k - 1][0], e.pts[k][1] - e.pts[k - 1][1]));
      e.cap = e.kind === 'elem' && e.id === 'C';                 // no wire and no markers across the capacitor gap
      e.s0 = nseg;
      if (!e.cap) { for (let k = 1; k < e.pts.length; k++) segEdge.push(ei); nseg += e.pts.length - 1; }
      // one spacing SP everywhere (slots for every marker that can fit); the phase starts where the previous edge in
      // layout order left off, so a series run of wires reads as one evenly spaced stream
      e.n = e.cap ? 0 : Math.floor(e.L / SP) + 1; e.base = nmk; nmk += e.n;
      e.off = -acc; acc += e.L;
      [e.pts[0], e.pts[e.pts.length - 1]].forEach(pt => { ends[key(pt)] = (ends[key(pt)] || 0) + 1; });
      e.pts.forEach((pt, k) => { verts[key(pt) + ':' + e.nodes[k]] = [pt, e.nodes[k]]; });
    });
    wires.count = Math.min(MAXW, nseg); markers.count = Math.min(MAXM, nmk);
    // junction dots (3 or more wire ends meet) and the RC switch contacts
    const dotPts = Object.keys(ends).filter(k => ends[k] >= 3).map(k => {
      const pt = k.split(',').map(Number), e = edges.find(x => key(x.pts[0]) === k || key(x.pts[x.pts.length - 1]) === k);
      return [pt, key(e.pts[0]) === k ? e.nodes[0] : e.nodes[e.nodes.length - 1], 1.15];
    });
    if (st.scene === 'rc') RC_CONTACTS.forEach(([pt, n]) => dotPts.push([pt, n, 1.5]));
    dots = dotPts.map(([pt, n, s]) => { const m = new THREE.Mesh(ballGeo, wireMat); m.scale.setScalar(s); sg.add(m); return { m, pt, n, dy: 0 }; });
    if (st.scene === 'rc') { const m = label('สวิตช์', P.muted, 0.6, true); sg.add(m); dots.push({ m, pt: [-3.9, 4], n: 2, dy: 0.75 }); }
    // floor shadow of every wire / element, and drop lines from the floor up to each corner
    const sh = [];
    edges.forEach(e => { for (let k = 1; k < e.pts.length; k++) sh.push(e.pts[k - 1][0], FLOOR + 0.01, -e.pts[k - 1][1], e.pts[k][0], FLOOR + 0.01, -e.pts[k][1]); });
    const sgeo = own(new THREE.BufferGeometry(), true); sgeo.setAttribute('position', new THREE.Float32BufferAttribute(sh, 3));
    shadow = new THREE.LineSegments(sgeo, shadowMat); sg.add(shadow);
    dropPts = Object.values(verts);
    const dgeo = own(new THREE.BufferGeometry(), true); dgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dropPts.length * 6), 3));
    drops = new THREE.LineSegments(dgeo, dropMat); drops.frustumCulled = false; sg.add(drops);
    edges.filter(e => e.kind === 'elem').forEach(e => elems.push(makeElem(e)));
    if (!validSel(st.sel)) st.sel = 'R1';
    syncChips();
  }

  function makeElem(e) {
    const o = { id: e.id, e, kind: KIND[e.id], g: new THREE.Group() };
    if (o.kind === 'res') {
      const big = e.id[0] === 'R';
      o.t = big ? 0.62 : 0.42;
      o.base = new THREE.Color(big ? P.res : P.rIn); o.hot = new THREE.Color(P.hot);
      o.mat = own(new THREE.MeshStandardMaterial({ color: o.base.clone(), roughness: 0.6, emissive: P.hot, emissiveIntensity: 0 }), true);
      o.body = new THREE.Mesh(boxGeo, o.mat); o.g.add(o.body);
    } else if (o.kind === 'emf') {
      o.t = 0.8;
      o.body = new THREE.Mesh(cylGeo, battMat); o.band = new THREE.Mesh(cylGeo, battPosMat); o.nub = new THREE.Mesh(cylGeo, battPosMat);
      o.g.add(o.body, o.band, o.nub);
      o.plus = new THREE.Sprite(plusMat); o.minus = new THREE.Sprite(minusMat);
      o.plus.scale.setScalar(0.6); o.minus.scale.setScalar(0.6); sg.add(o.plus, o.minus);
    } else {
      o.t = 1;
      o.pa = new THREE.Mesh(boxGeo, plateA); o.pb = new THREE.Mesh(boxGeo, plateB); o.g.add(o.pa, o.pb);
    }
    o.g.children.forEach(m => { m.userData.id = e.id; });
    o.arrow = new THREE.Mesh(coneGeo, arrowMat);
    o.label = label(nm(e.id), P.label, 0.85, true);
    sg.add(o.g, o.arrow, o.label);
    return o;
  }
  const nm = id => (id === 'R1' && (st.scene === 'single' || st.scene === 'rc')) ? 'R' : NAME[id];
  // a selection is an element id ('R1', 'eps', …) or a wire section 'w<edge index>'
  const wireOf = id => (typeof id === 'string' && id[0] === 'w' && edges[+id.slice(1)] && edges[+id.slice(1)].kind === 'wire') ? edges[+id.slice(1)] : null;
  const validSel = id => !!wireOf(id) || elems.some(o => o.id === id);

  /* ── heights → transforms (on every change; every frame while the RC clock runs) ── */
  const _P = new THREE.Vector3(), _Q = new THREE.Vector3(), _D = new THREE.Vector3(), _M = new THREE.Vector3(), _Dh = new THREE.Vector3(), _T = new THREE.Vector3();
  const _o = new THREE.Object3D(), AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
  function applyHeights() {
    let si = 0;
    edges.forEach(e => {
      if (e.cap) return;
      for (let k = 1; k < e.pts.length && si < MAXW; k++, si++) {
        _P.set(e.pts[k - 1][0], yOf(e.nodes[k - 1]), -e.pts[k - 1][1]); _Q.set(e.pts[k][0], yOf(e.nodes[k]), -e.pts[k][1]);
        _D.subVectors(_Q, _P); const len = _D.length();
        _o.position.addVectors(_P, _Q).multiplyScalar(0.5);
        if (len > 1e-9) _o.quaternion.setFromUnitVectors(AY, _D.multiplyScalar(1 / len));
        _o.scale.set(WR, len + WR, WR); _o.updateMatrix(); wires.setMatrixAt(si, _o.matrix);
      }
    });
    wires.instanceMatrix.needsUpdate = true;
    dots.forEach(d => d.m.position.set(d.pt[0], yOf(d.n) + d.dy, -d.pt[1]));
    const da = drops.geometry.attributes.position.array;
    dropPts.forEach(([pt, n], k) => { const y = yOf(n); da.set([pt[0], FLOOR, -pt[1], pt[0], Math.max(FLOOR, y), -pt[1]], 6 * k); });
    drops.geometry.attributes.position.needsUpdate = true; drops.visible = st.showHeight;
    ruler.visible = st.showHeight;
    elems.forEach(placeElem);
    placeMarkers(0);
  }
  function placeElem(o) {
    const e = o.e, A = e.pts[0], B = e.pts[1];
    _P.set(A[0], yOf(e.na), -A[1]); _Q.set(B[0], yOf(e.nb), -B[1]);
    _D.subVectors(_Q, _P); const len = _D.length(); _D.normalize();
    _M.addVectors(_P, _Q).multiplyScalar(0.5);
    _Dh.set(B[0] - A[0], 0, A[1] - B[1]).normalize();
    let top = o.t / 2;
    if (o.kind === 'res') {
      o.body.position.copy(_M); o.body.quaternion.setFromUnitVectors(AX, _D); o.body.scale.set(len * 0.8, o.t, o.t);
      const g = Math.min(1, Math.max(0, st.el[o.id].P / REF[st.scene].P));
      o.mat.emissiveIntensity = 0.75 * g; o.mat.color.copy(o.base).lerp(o.hot, 0.7 * g);
    } else if (o.kind === 'emf') {
      const q = new THREE.Quaternion().setFromUnitVectors(AY, _D);
      o.body.position.copy(_M); o.body.quaternion.copy(q); o.body.scale.set(0.4, len * 0.78, 0.4);
      o.band.position.copy(_M).addScaledVector(_D, len * 0.3); o.band.quaternion.copy(q); o.band.scale.set(0.41, len * 0.18, 0.41);
      o.nub.position.copy(_M).addScaledVector(_D, len * 0.39 + 0.1); o.nub.quaternion.copy(q); o.nub.scale.set(0.15, 0.2, 0.15);
      _T.set(0.62 * side(A), 0.1, 0);
      o.plus.position.copy(_Q).add(_T); o.minus.position.copy(_P).add(_T);
    } else {
      const q = new THREE.Quaternion().setFromUnitVectors(AZ, _Dh);
      o.pa.position.copy(_P); o.pb.position.copy(_Q);
      [o.pa, o.pb].forEach(m => { m.quaternion.copy(q); m.scale.set(1.3, 1.0, 0.1); });
      const f = Math.min(1, Math.max(0, st.el.C.V / st.p.eps));
      plateA.color.setHex(P.plate).lerp(new THREE.Color(P.pos), f); plateB.color.setHex(P.plate).lerp(new THREE.Color(P.neg), f);
      top = 0.5 + Math.abs(_P.y - _Q.y) / 2;
    }
    o.arrow.position.copy(_M); o.arrow.position.y += top + 0.32;
    o.arrow.quaternion.setFromUnitVectors(AY, o.kind === 'cap' ? _Dh : _D);
    if (Math.abs(_Dh.z) > Math.abs(_Dh.x)) o.label.position.set(_M.x + 1.35 * side(A), _M.y + 0.3, _M.z);
    else o.label.position.set(_M.x, _M.y + top + 1.05, _M.z);
  }
  const side = A => (A[0] < -0.01 ? -1 : 1);

  /* ── markers: evenly spaced, speed K·I (signed) ── */
  function posAt(e, s, out) {
    let j = 1; while (j < e.cum.length - 1 && e.cum[j] < s) j++;
    const a = e.pts[j - 1], b = e.pts[j], seg = e.cum[j] - e.cum[j - 1], u = seg > 0 ? (s - e.cum[j - 1]) / seg : 0;
    const ya = yOf(e.nodes[j - 1]), yb = yOf(e.nodes[j]);
    out[0] = a[0] + (b[0] - a[0]) * u; out[1] = ya + (yb - ya) * u; out[2] = -(a[1] + (b[1] - a[1]) * u);
  }
  const _p = [0, 0, 0];
  function placeMarkers(dt) {
    markers.visible = st.showMarkers;
    if (!st.showMarkers) return;
    const arr = markers.instanceMatrix.array;
    st.elapsed += dt;
    edges.forEach(e => {
      if (!e.n || e.base + e.n > MAXM) return;
      e.off += st.K * e.I * dt;                              // unwrapped: distance the stream has moved along a → b
      const ph = ((e.off % SP) + SP) % SP;
      for (let k = 0; k < e.n; k++) {
        const s = ph + k * SP, i = 16 * (e.base + k), on = s < e.L;
        arr[i] = arr[i + 5] = arr[i + 10] = on ? 1 : 0;        // slots past the end of the edge are hidden
        if (on) { posAt(e, s, _p); arr[i + 12] = _p[0]; arr[i + 13] = _p[1]; arr[i + 14] = _p[2]; }
      }
    });
    markers.instanceMatrix.needsUpdate = true;
  }

  /* ── formatting ── */
  const PFX = [[1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n']];
  function q(x, unit, d = 3) {
    if (x === null || x === undefined || !isFinite(x)) return '—';
    const a = Math.abs(x); if (a < 1e-12) return '0 ' + unit;
    const [m, pf] = PFX.find(([v]) => a >= v * 0.9995) || PFX[PFX.length - 1];
    const y = a / m, dec = Math.max(0, d - 1 - Math.floor(Math.log10(y * 1.0000001)));
    return (x < 0 ? '−' : '') + y.toFixed(dec) + ' ' + pf + unit;
  }

  /* ── panel ── */
  U.head('ห้องทดลองวงจรไฟฟ้า', 'ความสูงของสายเหนือพื้น = ศักย์ไฟฟ้า V · อนุภาคแทนประจุบวก วิ่งตามทิศกระแสตามข้อตกลง');
  U.group('เลือกวงจร');
  const sceneBox = U.seg({ value: st.scene, options: [['single', 'เดี่ยว'], ['series', 'อนุกรม'], ['parallel', 'ขนาน'], ['mixed', 'ผสม'], ['twoloop', 'สองวงรอบ'], ['rc', 'RC']] },
    v => { if (uiReady) setScene(v); });
  sceneBox.classList.add('ck-scenes');
  const descEl = U.html('<div class="ck-desc"></div>');

  U.group('ปรับค่า');
  const SL = {};
  const r2s = v => Number(v.toPrecision(2));
  const fR = v => (v < 10 ? v.toFixed(1) : v.toFixed(0)) + ' Ω';
  function addSlider(name, label, min, max, step, toVal, toPos, fmt) {
    const el = U.slider({ label, min, max, step, value: toPos(st.p[name]), fmt: x => fmt(toVal(x)) }, x => { if (uiReady) setParam(name, toVal(x), true); });
    el.dataset.p = name;
    const box = el.closest('.ctl');
    SL[name] = { el, toPos, fmt, box, lab: box.querySelector('label'), val: box.querySelector('.ctl-val') };
  }
  const lin = x => x, logv = x => r2s(Math.pow(10, x)), logp = v => Math.log10(v);
  addSlider('eps', 'แรงเคลื่อนไฟฟ้า ε', 1, 24, 0.5, lin, lin, v => v.toFixed(1) + ' V');
  addSlider('eps2', 'แรงเคลื่อนไฟฟ้า ε₂', 1, 24, 0.5, lin, lin, v => v.toFixed(1) + ' V');
  addSlider('r', 'ความต้านทานภายใน r', RANGE.r[0], RANGE.r[1], 0.05, x => Math.max(RANGE.r[0], Number(x.toFixed(2))), lin, v => v.toFixed(2) + ' Ω');
  ['R1', 'R2', 'R3'].forEach(k => addSlider(k, 'ความต้านทาน ' + NAME[k], 0, 3, 0.01, logv, logp, fR));
  addSlider('C', 'ความจุ C', -5, -2, 0.01, logv, logp, v => q(v, 'F', 2));
  U.note('ความต้านทานภายใน r มีค่าต่ำสุด ' + Circuit.R_INTERNAL_MIN + ' Ω (ไม่เป็นศูนย์) วงจรจึงไม่มีกระแสเป็นอนันต์ · ตัวต้านทานทุกตัวเป็นแบบโอห์ม (R คงที่)');

  const rcBox = U.html(`<div class="ck-rc">
    <div class="p-group">สวิตช์และเวลา</div>
    <div class="ctl"><div class="seg ck-mode"><button data-v="charge">ชาร์จ (ต่อแบตเตอรี่)</button><button data-v="discharge">คายประจุ (ผ่าน R)</button></div></div>
    <div class="chips"><button class="ck-restart">↺ เริ่มจับเวลาใหม่</button></div>
    <div class="ck-msg" role="status" aria-live="polite"></div>
    <canvas class="chart ck-chart" aria-label="กราฟ V_C เทียบกับเวลา"></canvas>
    <div class="legend"><span><i style="background:${CH.acc}"></i>V<sub>C</sub>(t) ที่ผ่านมา</span><span><i style="background:${CH.muted}"></i>ทั้งช่วง 0 ถึง 5τ</span><span>เส้นประตั้ง: t = τ</span></div>
    <div class="ro-box"><div class="ro-title">ตัวเก็บประจุ</div>
      <div class="ro"><span>เวลา t</span><span class="mono" data-k="t">—</span></div>
      <div class="ro"><span data-l="tau">τ</span><span class="mono" data-k="tau">—</span></div>
      <div class="ro"><span>t / τ</span><span class="mono" data-k="tt">—</span></div>
      <div class="ro"><span>ประจุ q</span><span class="mono" data-k="q">—</span></div>
      <div class="ro"><span>V<sub>C</sub> = q / C</span><span class="mono" data-k="vc">—</span></div>
      <div class="ro"><span>กระแส i</span><span class="mono" data-k="i">—</span></div></div></div>`);
  const modeBox = rcBox.querySelector('.ck-mode'), msg = rcBox.querySelector('.ck-msg'), cv = rcBox.querySelector('.ck-chart');
  const RC = {}; rcBox.querySelectorAll('[data-k]').forEach(x => { RC[x.dataset.k] = x; });
  const tauLab = rcBox.querySelector('[data-l="tau"]');
  modeBox.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === st.rc.mode));
  modeBox.onclick = ev => { const b = ev.target.closest('button'); if (b) switchTo(b.dataset.v); };
  rcBox.querySelector('.ck-restart').onclick = () => { restartRC(false); update(); say('เริ่มจับเวลาใหม่ที่ t = 0'); };
  const HINT = 'นาฬิกาของวงจรถูกทำให้ช้าลง: ช่วงเวลา τ ใช้ราว 3 วินาทีบนจอ · เปลี่ยนค่าใดก็ตามจะเริ่มจับเวลาใหม่';
  function say(t) {
    clearTimeout(msgTimer); msg.textContent = t || HINT;
    if (t) msgTimer = setTimeout(() => { msg.textContent = HINT; }, 7000);
  }

  U.group('แสดงผล');
  U.check('อนุภาคประจุบวก (ความเร็ว ∝ กระแส)', st.showMarkers, v => { st.showMarkers = v; if (uiReady) placeMarkers(0); });
  U.check('ความสูงของสาย = ศักย์ไฟฟ้า', st.showHeight, v => { st.showHeight = v; if (uiReady) applyHeights(); });

  const RO = U.readouts('ทั้งวงจร', [['Rt', 'ความต้านทานภายนอกรวม'], ['It', 'กระแสผ่านแบตเตอรี่ I'], ['Vt', 'ความต่างศักย์ระหว่างขั้ว V = ε − Ir']]);
  const roLab = k => RO[k].previousElementSibling;

  U.group('ชิ้นหรือสายที่เลือก · แตะในฉากหรือเลือกที่นี่');
  const chips = U.html('<div class="chips ck-chips"></div>');
  chips.onclick = ev => { const b = ev.target.closest('button'); if (b) select(b.dataset.id); };
  const pickBox = U.html(`<div class="ro-box ck-pick"><div class="ro-title"></div>
    <div class="ro"><span data-l="I">กระแส I</span><span class="mono" data-k="I">—</span></div>
    <div class="ro"><span data-l="V"></span><span class="mono" data-k="V">—</span></div>
    <div class="ro"><span data-l="P"></span><span class="mono" data-k="P">—</span></div>
    <div class="ck-dir"></div></div>`);
  const PK = {}; pickBox.querySelectorAll('[data-k]').forEach(x => { PK[x.dataset.k] = x; });
  const PL = {}; pickBox.querySelectorAll('[data-l]').forEach(x => { PL[x.dataset.l] = x; });
  const pickTitle = pickBox.querySelector('.ro-title'), dirEl = pickBox.querySelector('.ck-dir');

  U.note('ตัวต้านทานยิ่งสว่าง (สีส้ม) ยิ่งเปลี่ยนพลังงานไฟฟ้าเป็นความร้อนมาก (P = I²R เทียบกันในฉากเดียวกัน) · ความสูงของสายวัดจากขั้วลบของแบตเตอรี่ (0 V) สูง 1 หน่วย = 4 V ตามไม้บรรทัดด้านหลังขวา: แบตเตอรี่ยกศักย์ขึ้น ε แล้วศักย์ลดลงเมื่อผ่าน r และตัวต้านทาน สายเส้นเดียวกันสูงเท่ากันตลอดเพราะถือว่าสายไม่มีความต้านทาน · ลูกศรเล็กเหนือแต่ละชิ้นคือทิศอ้างอิงของ I: ค่า I ติดลบแปลว่ากระแสจริงไหลสวนลูกศร');
  U.note('อนุภาคที่วิ่งตามสายเป็น<b>ภาพเชิงคุณภาพ</b>ของประจุบวก: กระแสยิ่งมากอนุภาคยิ่งวิ่งเร็ว ที่จุดแยกอนุภาคแบ่งไปตามสัดส่วนกระแสของแต่ละสาขาแล้วรวมกลับ กระแสจึง<b>ไม่ได้ถูกใช้หมดไประหว่างทาง</b> สิ่งที่ลดลงเมื่อผ่านตัวต้านทานคือศักย์ (ความสูงของสาย) · ในลวดทองแดงจริง อิเล็กตรอนลอยเลื่อน (drift) ช้ากว่านี้มาก ราว 0.1 mm/s สำหรับกระแส 1 A ในลวดหน้าตัด 1 mm² และเคลื่อนสวนทิศกระแส · ถ้ากระแสมากจนอนุภาคเร็วเกินไป ความเร็วทุกเส้นจะถูกลดลงในสัดส่วนเดียวกัน');

  const hintEl = stage && stage.querySelector('.sim-hint');
  if (hintEl) hintEl.textContent = 'แตะชิ้นหรือสายในวงจร: อ่านค่า · ลาก: หมุน · ล้อเมาส์ / สองนิ้ว: ซูม';

  function syncSliders() {
    Object.keys(SL).forEach(k => {
      const s = SL[k]; s.el.value = s.toPos(st.p[k]); s.val.textContent = s.fmt(st.p[k]);
      s.box.style.display = VIS[st.scene].includes(k) ? '' : 'none';
    });
    SL.R1.lab.textContent = 'ความต้านทาน ' + nm('R1');
    SL.r.lab.textContent = st.scene === 'twoloop' ? 'ความต้านทานภายใน r (แบตเตอรี่ละ)' : 'ความต้านทานภายใน r';
  }
  function syncChips() {
    const ids = ORDER.filter(id => elems.some(o => o.id === id));
    chips.innerHTML = ids.map(id => `<button data-id="${id}" class="${id === st.sel ? 'on' : ''}">${nm(id)}</button>`).join('');
  }
  function refresh() {
    const s = st.sum, tw = st.scene === 'twoloop';
    roLab('Rt').textContent = tw ? 'R รวมภายนอก (มีสองแบตเตอรี่: ไม่มีค่าเดียว)' : 'ความต้านทานภายนอกรวม R';
    roLab('It').textContent = tw ? 'กระแสรวม I_ε + I_ε₂ (ผ่าน R₃)' : 'กระแสผ่านแบตเตอรี่ I';
    roLab('Vt').textContent = tw ? 'ความต่างศักย์ระหว่างขั้วของแบตเตอรี่ ε: V = ε − Ir' : 'ความต่างศักย์ระหว่างขั้ว V = ε − Ir';
    RO.Rt.textContent = s.Rtotal === null ? '—' : q(s.Rtotal, 'Ω');
    RO.It.textContent = q(s.Itotal, 'A'); RO.Vt.textContent = q(s.Vterm, 'V');
    refreshPick();
    if (st.scene === 'rc') {
      const r = st.rcNow, tau = tauNow();
      tauLab.textContent = st.rc.mode === 'charge' ? 'τ = (R + r)C' : 'τ = RC';
      RC.t.textContent = q(st.rc.t, 's'); RC.tau.textContent = q(tau, 's'); RC.tt.textContent = (st.rc.t / tau).toFixed(2);
      RC.q.textContent = q(r.q, 'C'); RC.vc.textContent = q(r.vC, 'V'); RC.i.textContent = q(r.i, 'A');
      drawChart();
    }
  }
  function refreshPick() {
    const w = wireOf(st.sel);
    if (w) {
      // a wire section: the current through it and its potential (one value along the whole section: ideal wire)
      pickTitle.textContent = 'สายไฟ · ช่วงที่เลือก';
      PK.I.textContent = q(w.I, 'A');
      PL.V.textContent = 'ศักย์ไฟฟ้าของสาย V (เทียบขั้วลบแบตเตอรี่)'; PK.V.textContent = q(st.v[w.node], 'V');
      PL.P.textContent = 'ความต่างศักย์ระหว่างปลายสาย'; PK.P.textContent = q(0, 'V');
      dirEl.textContent = (Math.abs(w.I) < 1e-9 ? 'ไม่มีกระแสในช่วงสายนี้'
        : w.I > 0 ? 'I บวก: กระแสไหลตามลูกศรสีเขียวบนสาย' : 'I ติดลบ: กระแสไหลสวนลูกศรสีเขียวบนสาย (ดูอนุภาคที่วิ่งย้อน)')
        + ' · สายถือว่าไม่มีความต้านทาน ศักย์จึงเท่ากันตลอดช่วง';
      return;
    }
    const id = st.sel, o = st.el[id]; if (!o) return;
    const kind = KIND[id], n = nm(id);
    pickTitle.textContent = n + ' · ' + (kind === 'emf' ? 'แบตเตอรี่' : kind === 'cap' ? 'ตัวเก็บประจุ' : id[0] === 'r' ? 'ความต้านทานภายในแบตเตอรี่' : 'ตัวต้านทาน');
    PK.I.textContent = q(o.I, 'A');
    if (kind === 'emf') {
      const eps = st.p[id], rr = st.p.r;
      PL.V.textContent = 'ความต่างศักย์ระหว่างขั้ว V = ' + n + ' − I' + (id === 'eps2' ? 'r₂' : 'r'); PK.V.textContent = q(eps - o.I * rr, 'V');
      PL.P.textContent = 'กำลังที่แบตเตอรี่ให้ P = ' + n + 'I'; PK.P.textContent = q(o.P, 'W');
    } else if (kind === 'cap') {
      PL.V.textContent = 'V คร่อมตัวเก็บประจุ'; PK.V.textContent = q(o.V, 'V');
      PL.P.textContent = 'กำลังที่ส่งเข้าตัวเก็บประจุ P = VI'; PK.P.textContent = q(o.P, 'W');
    } else {
      PL.V.textContent = 'ความต่างศักย์คร่อม V = I' + n; PK.V.textContent = q(o.V, 'V');
      PL.P.textContent = 'กำลัง P = I²' + n; PK.P.textContent = q(o.P, 'W');
    }
    const I = o.I;
    dirEl.textContent = Math.abs(I) < 1e-9 ? 'ไม่มีกระแสผ่านชิ้นนี้ในตอนนี้'
      : kind === 'emf' ? (I > 0 ? 'กระแสไหลผ่านแบตเตอรี่จากขั้ว − ไปขั้ว +: แบตเตอรี่จ่ายพลังงานให้วงจร (ความต่างศักย์ระหว่างขั้วน้อยกว่า ' + n + ')'
        : 'I ติดลบ: กระแสไหลย้อนผ่านแบตเตอรี่จากขั้ว + ไปขั้ว −: แบตเตอรี่นี้รับพลังงาน (ถูกอัดประจุ) และความต่างศักย์ระหว่างขั้วมากกว่า ' + n)
      : (I > 0 ? 'I บวก: กระแสไหลตามลูกศรเล็กเหนือชิ้นนี้' : 'I ติดลบ: กระแสไหลย้อนสวนลูกศรเล็กเหนือชิ้นนี้ (ดูอนุภาคที่วิ่งย้อน)');
  }
  function drawChart() {
    const W = cv.clientWidth, Hh = cv.clientHeight; if (!W || !Hh) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
    const tau = tauNow(), TT = 5 * tau, eps = st.p.eps, l = 34, r = 12, t = 14, b = 24;
    const X = v => l + Math.min(1, v / TT) * (W - l - r), Y = v => t + (1 - v / eps) * (Hh - t - b);
    g.font = '10px "JetBrains Mono", monospace'; g.lineWidth = 1; g.strokeStyle = CH.line; g.fillStyle = CH.muted;
    g.textAlign = 'right'; [[0, '0'], [eps, 'ε']].forEach(([v, s]) => { g.beginPath(); g.moveTo(l, Y(v)); g.lineTo(W - r, Y(v)); g.stroke(); g.fillText(s, l - 6, Y(v) + 3); });
    g.fillText('V_C', l - 4, 9);
    g.textAlign = 'center';
    for (let k = 0; k <= 5; k++) g.fillText(k === 0 ? '0' : (k === 1 ? '' : k) + 'τ', X(k * tau), Hh - 8);
    g.strokeStyle = CH.muted; g.setLineDash([3, 3]);
    g.beginPath(); g.moveTo(X(tau), t); g.lineTo(X(tau), Hh - b); g.stroke();
    const yt = Y(rcAt(tau).vC); g.beginPath(); g.moveTo(l, yt); g.lineTo(X(tau), yt); g.stroke();
    g.beginPath();
    for (let s = 0; s <= 100; s++) { const tt = s / 100 * TT, y = Y(rcAt(tt).vC); s ? g.lineTo(X(tt), y) : g.moveTo(X(tt), y); }
    g.stroke(); g.setLineDash([]);
    const tn = Math.min(st.rc.t, TT);
    g.strokeStyle = CH.acc; g.lineWidth = 2.2; g.beginPath();
    for (let s = 0; s <= 80; s++) { const tt = s / 80 * tn, y = Y(rcAt(tt).vC); s ? g.lineTo(X(tt), y) : g.moveTo(X(tt), y); }
    g.stroke();
    g.fillStyle = CH.acc; g.beginPath(); g.arc(X(tn), Y(rcAt(tn).vC), 3.5, 0, 2 * Math.PI); g.fill();
  }

  /* ── state changes ── */
  function update() { compute(); applyHeights(); refresh(); }
  // a new circuit starts from its defaults; keep = true (rebuild after a theme switch) keeps values, pick and switch
  function setScene(id, keep) {
    if (!LAYOUT[id]) return;
    st.scene = id;
    if (!keep) { st.p = Circuit.defaults(id); st.sel = 'R1'; st.rc.mode = 'charge'; }
    restartRC(false);
    modeBox.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === st.rc.mode));
    sceneBox.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === id));
    descEl.textContent = DESC[id];
    rcBox.style.display = id === 'rc' ? '' : 'none';
    buildScene(); frame(edges); syncSliders(); update();
    if (id === 'rc') say('');
  }
  function setParam(name, v, fromSlider) {
    if (!RANGE[name] || typeof v !== 'number' || !isFinite(v)) return;
    v = Math.min(RANGE[name][1], Math.max(RANGE[name][0], v));
    st.p[name] = v;
    if (!fromSlider) { const s = SL[name]; s.el.value = s.toPos(v); s.val.textContent = s.fmt(v); }
    if (st.scene === 'rc') restartRC(true);
    update();
  }
  function select(id) {
    if (!validSel(id)) return;
    st.sel = id;
    chips.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.id === id));
    refreshPick();
  }
  // end points of drawn wire cylinder si, read back from its instance matrix (world-local coordinates)
  const _m4 = new THREE.Matrix4(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
  function segEnds(si, A, B) {
    wires.getMatrixAt(si, _m4); const m = _m4.elements;
    const sy = Math.hypot(m[4], m[5], m[6]), h = sy > 0 ? (sy - WR) / 2 / sy : 0;
    A.set(m[12] - m[4] * h, m[13] - m[5] * h, m[14] - m[6] * h); B.set(m[12] + m[4] * h, m[13] + m[5] * h, m[14] + m[6] * h);
  }
  const _box = new THREE.Box3(), _c = new THREE.Vector3();
  function syncSel() {
    const o = elems.find(x => x.id === st.sel), w = wireOf(st.sel);
    selBox.visible = !!(o || w); selArrow.visible = !!w;
    if (o) _box.setFromObject(o.g);
    else if (w) {
      // box around the section, arrow on its longest piece pointing along the polyline (I > 0 direction)
      _box.makeEmpty(); let best = -1;
      for (let k = 0; k < w.pts.length - 1; k++) {
        segEnds(w.s0 + k, _a, _b);
        _box.expandByPoint(world.localToWorld(_a.clone())).expandByPoint(world.localToWorld(_b.clone()));
        const len = _a.distanceTo(_b);
        if (len > best) { best = len; selArrow.position.addVectors(_a, _b).multiplyScalar(0.5); selArrow.position.y += 0.4; if (len > 1e-9) selArrow.quaternion.setFromUnitVectors(AY, _b.sub(_a).normalize()); }
      }
      _box.expandByScalar(0.15);
    } else return;
    _box.getCenter(selBox.position); _box.getSize(_c);
    selBox.scale.set(_c.x + 0.3, _c.y + 0.3, _c.z + 0.3);
  }

  /* ── pointer: tap / click an element to read it ── */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), _s = new THREE.Vector3();
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  function pickAt(cx, cy, type) {
    const r = canvas.getBoundingClientRect();
    ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    // the wire cylinder of an element edge runs inside the element, so a hit on it reads the element
    const idOfSeg = si => { const ei = segEdge[si], e = edges[ei]; return !e ? null : e.kind === 'elem' ? e.id : 'w' + ei; };
    const hits = ray.intersectObjects([...elems.map(o => o.g), wires], true);
    for (const h of hits) {
      const id = h.object === wires ? idOfSeg(h.instanceId) : h.object.userData.id;
      if (id) return id;
    }
    // nothing under the pointer: nearest element centre or wire piece on screen within a slop
    const slop = type !== 'mouse' || coarse ? 24 : 8;
    const px = v => { v.project(camera); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; };
    let best = null, bd = Infinity;
    elems.forEach(o => {
      _box.setFromObject(o.g); _box.getCenter(_s); const [x, y] = px(_s);
      const d = Math.hypot(x - cx, y - cy);
      if (d <= slop && d < bd) { bd = d; best = o.id; }
    });
    for (let si = 0; si < wires.count; si++) {
      segEnds(si, _a, _b); const [ax, ay] = px(world.localToWorld(_a)), [bx, by] = px(world.localToWorld(_b));
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, u = L2 ? Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / L2)) : 0;
      const d = Math.hypot(ax + u * dx - cx, ay + u * dy - cy);
      if (d <= slop && d < bd) { bd = d; best = idOfSeg(si); }
    }
    return best;
  }
  let down = null;
  const onDown = e => { if (e.pointerType === 'mouse' && e.button !== 0) return; down = { x: e.clientX, y: e.clientY, id: e.pointerId }; };
  const onUp = e => {
    if (!down || e.pointerId !== down.id) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6; down = null;
    if (moved) return;
    const id = pickAt(e.clientX, e.clientY, e.pointerType); if (id) select(id);
  };
  const onCancel = () => { down = null; };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);

  /* ── start ── */
  setScene(st.scene, true);
  uiReady = true; built = true;

  host.onUpdate(dt => {
    frames++;
    if (st.play) {
      if (st.scene === 'rc') {
        const tau = tauNow();
        if (st.rc.t < T_END * tau) { st.rc.t = Math.min(T_END * tau, st.rc.t + dt * tau / T_SCREEN); compute(); applyHeights(); refresh(); }
      }
      placeMarkers(dt);
    }
    syncSel();
  });

  /* ── test hook ── */
  const hook = window.__ck = {
    ready: () => built,
    scene: id => setScene(id),
    current: () => st.scene,
    setParam: (name, v) => setParam(name, v, false),
    params: () => Object.assign({}, st.p),
    readout: id => (st.el[id] ? { I: st.el[id].I, V: st.el[id].V, P: st.el[id].P } : null),
    summary: () => Object.assign({}, st.sum),
    markerSpeed: id => (id in st.I ? st.K * st.I[id] : null),
    wireHeight: n => yOf(n),
    rc: () => { const r = rcAt(st.rc.t); return { t: st.rc.t, q: r.q, vC: r.vC, i: r.i, tau: tauNow(), mode: st.rc.mode }; },
    switchTo: mode => switchTo(mode),
    setTime(t) { st.rc.t = Math.max(0, +t || 0); if (st.scene === 'rc') update(); },
    pick: id => select(id),
    selected: () => st.sel,
    screenOf(id) {
      const o = elems.find(x => x.id === id); if (!o) return null;
      world.updateMatrixWorld(); camera.updateMatrixWorld();
      _box.setFromObject(o.g); _box.getCenter(_s); _s.project(camera);
      const r = canvas.getBoundingClientRect();
      return { x: r.left + (_s.x + 1) / 2 * r.width, y: r.top + (1 - _s.y) / 2 * r.height };
    },
    // what is drawn: every edge with its layout end points (schematic X, Y), current, marker phase, the drawn pieces
    // read back from the wire instance matrices (capacitor: its two plates) and the visible markers' positions
    edges: () => edges.map((e, ei) => {
      const segs = [];
      if (e.cap) { const o = elems.find(x => x.id === 'C'); segs.push([...o.pa.position.toArray(), ...o.pb.position.toArray()]); }
      else for (let k = 0; k < e.pts.length - 1; k++) { segEnds(e.s0 + k, _a, _b); segs.push([..._a.toArray(), ..._b.toArray()]); }
      const mk = [], arr = markers.instanceMatrix.array;
      for (let k = 0; k < e.n; k++) { const i = 16 * (e.base + k); if (arr[i]) mk.push([arr[i + 12], arr[i + 13], arr[i + 14]]); }
      return { i: ei, kind: e.kind, id: e.kind === 'elem' ? e.id : 'w' + ei, nodes: e.nodes, pts: e.pts, I: e.I, off: e.off, L: e.L, segs, markers: mk };
    }),
    spacing: SP,
    elapsed: () => st.elapsed,
    screenOfEdge(ei) {
      const e = edges[ei]; if (!e || e.cap) return null;
      let best = -1, mid = new THREE.Vector3();
      for (let k = 0; k < e.pts.length - 1; k++) { segEnds(e.s0 + k, _a, _b); const len = _a.distanceTo(_b); if (len > best) { best = len; mid.addVectors(_a, _b).multiplyScalar(0.5); } }
      world.updateMatrixWorld(); camera.updateMatrixWorld();
      world.localToWorld(mid).project(camera);
      const r = canvas.getBoundingClientRect();
      return { x: r.left + (mid.x + 1) / 2 * r.width, y: r.top + (1 - mid.y) / 2 * r.height };
    },
    colors: () => [wireMat.color.getHexString(), markerMat.color.getHexString(), battMat.color.getHexString()],
    frames: () => frames,
    mem: () => ({ g: renderer.info.memory.geometries, t: renderer.info.memory.textures }),
    _owned: () => [...owned]
  };

  return {
    toggle() { st.play = !st.play; return st.play; },
    dispose() {
      clearTimeout(msgTimer);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      simCircuit.saved = { scene: st.scene, p: Object.assign({}, st.p), sel: st.sel, showMarkers: st.showMarkers, showHeight: st.showHeight, mode: st.rc.mode };
      clearScene();
      owned.forEach(x => x.dispose()); owned.clear();
      wires.dispose(); markers.dispose();
      scene.remove(selBox);
      if (window.__ck === hook) delete window.__ck;
    }
  };
}
