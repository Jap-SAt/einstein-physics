/* ─────────── Sim : projectile motion (บทที่ 01 กลศาสตร์) ───────────
   Exact kinematics, no air resistance. 1 unit in the scene = 1 m.
   x = u cosθ t,  y = h0 + u sinθ t − ½ g t² */
function simProjectile(host, U) {
  const { world, scene } = host;
  const PL = { earth: ['โลก', 9.81], moon: ['ดวงจันทร์', 1.62], mars: ['ดาวอังคาร', 3.71], jupiter: ['ดาวพฤหัสบดี', 24.79] };
  const st = { u: 20, th: 45, h0: 0, g: 9.81, play: true, t: 0, wait: 0, comp: true, auto: true };
  const dark = isDark();
  const C = { ball: 0x0f8486, path: dark ? 0x6a6d75 : 0xb4b0a7, v: 0x1c9a5a, vx: 0x3a6fd9, vy: 0xd0602a, ghost: dark ? 0x3a3c42 : 0xd8d4cc };

  let grid = null, S = 1;                       // S = size factor so markers stay visible at any range
  const ground = new THREE.Group(); world.add(ground);
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: dark ? 0x3b3d44 : 0xcfcac0, roughness: 0.9 }));
  world.add(pillar);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 2.4, 20), new THREE.MeshStandardMaterial({ color: dark ? 0x9ea2ab : 0x4a4e57, roughness: 0.5 }));
  const barrelG = new THREE.Group(); barrelG.add(barrel); barrel.position.y = 1.2; world.add(barrelG);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 16), new THREE.MeshStandardMaterial({ color: C.ball, roughness: 0.35 })); world.add(ball);
  const NP = 160;
  const predGeo = new THREE.BufferGeometry(); predGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  const pred = new THREE.Line(predGeo, new THREE.LineDashedMaterial({ color: C.path, dashSize: 0.6, gapSize: 0.5 })); pred.frustumCulled = false; world.add(pred);
  const TN = 1200, trailArr = new Float32Array(TN * 3), trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailArr, 3)); trailGeo.setDrawRange(0, 0);
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: C.ball })); trail.frustumCulled = false; world.add(trail);
  let tc = 0;
  const ghosts = [];
  const vA = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, C.v);
  const xA = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, C.vx);
  const yA = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, C.vy);
  world.add(vA, xA, yA);
  const peak = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 10), new THREE.MeshBasicMaterial({ color: C.vy })); world.add(peak);
  let rLabel = null, hLabel = null;

  function theory() {
    const th = st.th * Math.PI / 180, ux = st.u * Math.cos(th), uy = st.u * Math.sin(th), g = st.g;
    const T = (uy + Math.sqrt(uy * uy + 2 * g * st.h0)) / g;
    return { th, ux, uy, g, T, R: ux * T, H: st.h0 + uy * uy / (2 * g), tH: uy / g, vLand: Math.sqrt(ux * ux + Math.pow(uy - g * T, 2)) };
  }
  const posAt = (k, t) => [k.ux * t, st.h0 + k.uy * t - 0.5 * k.g * t * t];

  function rebuild(newShot) {
    const k = theory();
    S = Math.max(1, Math.max(k.R, k.H) / 30);
    // ground grid sized to the range
    if (grid) { ground.remove(grid); grid.geometry.dispose(); grid.material.dispose(); }
    const span = Math.max(20, k.R * 1.3, k.H * 1.2), step = niceStep(span / 16), size = Math.ceil(span / step) * step;
    const gc = gridHex(); grid = new THREE.GridHelper(size * 2, Math.round(size * 2 / step), gc[0], gc[1]);
    grid.position.set(size * 0.35, 0, 0); ground.add(grid);
    // launcher
    pillar.visible = st.h0 > 0.01; pillar.scale.set(1.6 * S, Math.max(0.01, st.h0), 1.6 * S); pillar.position.set(0, st.h0 / 2, 0);
    barrelG.position.set(0, st.h0, 0); barrelG.rotation.z = -(Math.PI / 2 - k.th); barrelG.scale.setScalar(S);
    ball.scale.setScalar(S); peak.scale.setScalar(S);
    // predicted path
    const a = predGeo.attributes.position.array;
    for (let i = 0; i < NP; i++) { const p = posAt(k, k.T * i / (NP - 1)); a[i * 3] = p[0]; a[i * 3 + 1] = p[1]; a[i * 3 + 2] = 0; }
    predGeo.attributes.position.needsUpdate = true; predGeo.computeBoundingSphere(); pred.computeLineDistances();
    pred.material.dashSize = 0.6 * S; pred.material.gapSize = 0.5 * S;
    peak.position.set(k.ux * Math.max(0, k.tH), k.H, 0); peak.visible = k.tH > 0;
    [rLabel, hLabel].forEach(l => { if (l) { world.remove(l); l.material.map.dispose(); l.material.dispose(); } });
    rLabel = makeLabel('R = ' + k.R.toFixed(1) + ' m', dark ? '#cfccc4' : '#4a4e57', 1.1 * S); rLabel.position.set(k.R, 1.2 * S, 0); world.add(rLabel);
    hLabel = makeLabel('H = ' + k.H.toFixed(1) + ' m', '#d0602a', 1.1 * S); hLabel.position.set(k.ux * Math.max(0, k.tH), k.H + 1.4 * S, 0); world.add(hLabel);
    if (newShot) { st.t = 0; st.wait = 0; tc = 0; trailGeo.setDrawRange(0, 0); }
    if (st.auto) {
      const span2 = Math.max(k.R, k.H * 1.6, 12);
      const tgt = new THREE.Vector3(k.R / 2, Math.max(k.H, st.h0) / 2, 0);
      host.setHome(tgt.clone().add(new THREE.Vector3(0.25, 0.22, 1).normalize().multiplyScalar(span2 * 1.15 + 6)), tgt);
    }
    refresh(k);
  }
  function niceStep(x) { const p = Math.pow(10, Math.floor(Math.log10(x))), m = x / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
  function keepGhost() {
    if (tc < 4) return;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(trailArr.slice(0, tc * 3), 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: C.ghost })); world.add(l); ghosts.push(l);
    while (ghosts.length > 3) { const o = ghosts.shift(); world.remove(o); o.geometry.dispose(); o.material.dispose(); }
  }

  let RO = null, LIVE = null;
  function refresh(k) {
    if (!RO) return;
    RO.T.textContent = k.T.toFixed(2) + ' s';
    RO.R.textContent = k.R.toFixed(2) + ' m';
    RO.H.textContent = k.H.toFixed(2) + ' m';
    RO.ux.textContent = k.ux.toFixed(2) + ' m/s';
    RO.vl.textContent = k.vLand.toFixed(2) + ' m/s';
    RO.rate.textContent = '×' + rate(k).toFixed(1);
  }
  const rate = k => Math.max(1, k.T / 4.5);   // long flights are sped up so each takes ~4–5 s on screen

  U.head('การเคลื่อนที่แบบโพรเจกไทล์', 'ไม่คิดแรงต้านอากาศ · 1 หน่วยในภาพ = 1 m');
  U.group('สภาพแวดล้อม');
  U.seg({ value: 'earth', options: Object.entries(PL).map(([k, v]) => [k, v[0]]) }, v => { st.g = PL[v][1]; if (RO) { keepGhost(); rebuild(true); } });
  U.group('การยิง');
  U.slider({ label: 'อัตราเร็วต้น u', min: 5, max: 40, step: 0.5, value: 20, fmt: x => x.toFixed(1) + ' m/s' }, x => { st.u = x; if (RO) { keepGhost(); rebuild(true); } });
  U.slider({ label: 'มุมยิง θ', min: 5, max: 85, step: 1, value: 45, fmt: x => x + '°' }, x => { st.th = x; if (RO) { keepGhost(); rebuild(true); } });
  U.slider({ label: 'ความสูงจุดยิง h₀', min: 0, max: 30, step: 0.5, value: 0, fmt: x => x.toFixed(1) + ' m' }, x => { st.h0 = x; if (RO) { keepGhost(); rebuild(true); } });
  U.check('แสดงองค์ประกอบความเร็ว vₓ และ v_y', true, v => { st.comp = v; });
  U.check('จัดกล้องให้เห็นทั้งวิถีอัตโนมัติ', true, v => { st.auto = v; if (v && RO) rebuild(false); });
  U.html('<div class="legend"><span><i style="background:#1c9a5a"></i>v</span><span><i style="background:#3a6fd9"></i>vₓ (คงที่)</span><span><i style="background:#d0602a"></i>v_y</span><span><i style="background:#b4b0a7"></i>วิถีที่คำนวณ</span></div>');
  RO = U.readouts('ค่าจากสูตร', [['T', 'เวลาลอย T'], ['R', 'ระยะตก R'], ['H', 'ความสูงสูงสุด H'], ['ux', 'vₓ = u cosθ'], ['vl', 'อัตราเร็วตอนตก'], ['rate', 'ภาพเร็วกว่าจริง']]);
  LIVE = U.readouts('ขณะเคลื่อนที่', [['t', 'เวลา t'], ['x', 'ตำแหน่ง x'], ['y', 'ตำแหน่ง y'], ['vx', 'vₓ'], ['vy', 'v_y'], ['ek', 'Eₖ/m = ½v²'], ['ep', 'Eₚ/m = gy'], ['e', 'พลังงานรวม/m']]);
  U.note('ลองยิง 30° และ 60° ด้วยอัตราเร็วเดียวกัน ระยะตกเท่ากัน · ที่จุดสูงสุด v_y = 0 แต่ vₓ ยังเท่าเดิม · พลังงานรวมต่อมวลคงที่ตลอดการเคลื่อนที่');
  rebuild(true);

  let acc = 1;
  host.onUpdate(dt => {
    const k = theory();
    if (st.play) {
      if (st.t < k.T) st.t = Math.min(k.T, st.t + dt * rate(k));
      else { st.wait += dt; if (st.wait > 1.4) { keepGhost(); st.t = 0; st.wait = 0; tc = 0; } }
    }
    const [x, y] = posAt(k, st.t), vy = k.uy - k.g * st.t;
    ball.position.set(x, y, 0);
    if (st.play && st.t <= k.T && tc < TN) { trailArr[tc * 3] = x; trailArr[tc * 3 + 1] = y; trailArr[tc * 3 + 2] = 0; tc++; trailGeo.attributes.position.needsUpdate = true; trailGeo.setDrawRange(0, tc); trailGeo.computeBoundingSphere(); }
    const sc = 0.22 * S;                                  // arrow length per (m/s)
    const vlen = Math.hypot(k.ux, vy);
    vA.position.copy(ball.position); vA.setDirection(new THREE.Vector3(k.ux, vy, 0).normalize()); const hd = L => Math.min(0.9 * S, L * 0.45); const VL = Math.max(0.01, vlen * sc), XL = Math.max(0.01, k.ux * sc), YL = Math.max(0.01, Math.abs(vy) * sc);
    vA.setLength(VL, hd(VL), 0.5 * S);
    xA.visible = yA.visible = st.comp;
    xA.position.copy(ball.position); xA.setLength(XL, hd(XL), 0.45 * S);
    yA.position.copy(ball.position); yA.setDirection(new THREE.Vector3(0, Math.sign(vy) || 1, 0)); yA.setLength(YL, hd(YL), 0.45 * S);
    acc += dt;
    if (acc > 0.07) {
      acc = 0;
      const ek = 0.5 * (k.ux * k.ux + vy * vy), ep = k.g * y;
      LIVE.t.textContent = st.t.toFixed(2) + ' s';
      LIVE.x.textContent = fx(x, 2) + ' m';
      LIVE.y.textContent = fx(y, 2) + ' m';
      LIVE.vx.textContent = fx(k.ux, 2) + ' m/s';
      LIVE.vy.textContent = fx(vy, 2) + ' m/s';
      LIVE.ek.textContent = ek.toFixed(1) + ' J/kg';
      LIVE.ep.textContent = ep.toFixed(1) + ' J/kg';
      LIVE.e.textContent = (ek + ep).toFixed(1) + ' J/kg';
    }
  });
  return {
    toggle() { st.play = !st.play; return st.play; },
    dispose() { ghosts.forEach(o => { o.geometry.dispose(); o.material.dispose(); }); }
  };
}
