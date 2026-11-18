/* ─────────── Sim 1 : charged particle in B ─────────── */
function simParticle(host, U) {
  const { world } = host;
  const e = 1.602176634e-19, mp = 1.67262192595e-27;
  host.setHome(new THREE.Vector3(26, 9, 26), new THREE.Vector3(0, 0, 0));
  const TYPES = {
    p: { q: 1, m: mp, c: 0xd94a3a },
    a: { q: 2, m: 6.6446573450e-27, c: 0xe0912b },
    pb: { q: -1, m: mp, c: 0x2f6fd1 }
  };
  const st = { type: 'p', B: 1, v: 5e5, th: 70, phi: 0, y: -12, play: true };
  const YL = 14;
  // field lines along +y
  const fp = [], CS = [-24, -12, 0, 12, 24];
  CS.forEach(x => CS.forEach(z => fp.push(x, -YL - 2, z, x, YL + 2, z)));
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  world.add(new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: 0x9db0ea, transparent: true, opacity: 0.5 })));
  const cg = new THREE.ConeGeometry(0.5, 1.4, 14), cm = new THREE.MeshBasicMaterial({ color: 0x9db0ea });
  CS.forEach(x => CS.forEach(z => { const c = new THREE.Mesh(cg, cm); c.position.set(x, YL + 2.6, z); world.add(c); }));
  const bl = makeLabel('B', '#3a5bd9', 2.4); bl.position.set(-24, YL + 5, -24); world.add(bl);
  const grid = new THREE.GridHelper(60, 10, gridHex()[0], gridHex()[1]); grid.position.y = -YL - 2; world.add(grid);
  // particle + trail + arrows
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 16), new THREE.MeshStandardMaterial({ color: 0xd94a3a, roughness: 0.35 }));
  world.add(ball);
  const TN = 1400, tp = new Float32Array(TN * 3), tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tg.setDrawRange(0, 0);
  const tmat = new THREE.LineBasicMaterial({ color: 0xd94a3a }); const trail = new THREE.Line(tg, tmat); trail.frustumCulled = false; world.add(trail);
  let tc = 0; const clear = () => { tc = 0; tg.setDrawRange(0, 0); };
  const vA = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 4.5, 0x1c9a5a, 1.2, 0.7);
  const fA = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 4.5, 0x8a3fd1, 1.2, 0.7);
  world.add(vA, fA);

  function phys() {
    const T = TYPES[st.type], q = Math.abs(T.q) * e, th = st.th * Math.PI / 180;
    const R = T.m * st.v / (q * st.B), r = R * Math.sin(th), w = q * st.B / T.m, per = 2 * Math.PI / w;
    return { T, q, th, R, r, w, per, pitch: st.v * Math.cos(th) * per, F: q * st.v * st.B * Math.sin(th), KE: 0.5 * T.m * st.v * st.v / e };
  }
  let RO = null, LIVE = null;
  function refresh() {
    if (!RO) return; const k = phys();
    RO.r.textContent = (k.r * 1000).toFixed(2) + ' mm';
    RO.T.textContent = (k.per * 1e9).toFixed(2) + ' ns';
    RO.f.textContent = (1 / k.per / 1e6).toFixed(2) + ' MHz';
    RO.p.textContent = (k.pitch * 1000).toFixed(2) + ' mm';
    RO.F.textContent = sci(k.F, 2) + ' N';
    RO.K.textContent = (k.KE / 1000).toFixed(3) + ' keV';
  }
  U.head('อนุภาคมีประจุในสนามแม่เหล็กสม่ำเสมอ', 'สนาม B ชี้ขึ้น (+y) · 1 หน่วยในภาพ = 1 mm');
  U.group('อนุภาค');
  U.seg({ value: 'p', options: [['p', 'โปรตอน'], ['a', 'แอลฟา'], ['pb', 'แอนติโปรตอน']] }, v => {
    st.type = v; ball.material.color.setHex(TYPES[v].c); tmat.color.setHex(TYPES[v].c); clear(); refresh();
  });
  U.group('พารามิเตอร์');
  U.slider({ label: 'สนามแม่เหล็ก B', min: 0.2, max: 2, step: 0.05, value: 1, fmt: x => x.toFixed(2) + ' T' }, x => { st.B = x; clear(); refresh(); });
  U.slider({ label: 'อัตราเร็ว v', min: 1, max: 10, step: 0.1, value: 5, fmt: x => x.toFixed(1) + ' × 10⁵ m/s' }, x => { st.v = x * 1e5; clear(); refresh(); });
  U.slider({ label: 'มุมระหว่าง v กับ B (θ)', min: 0, max: 90, step: 1, value: 70, fmt: x => x + '°' }, x => { st.th = x; clear(); refresh(); });
  U.html('<div class="legend"><span><i style="background:#1c9a5a"></i>ความเร็ว v</span><span><i style="background:#8a3fd1"></i>แรง F</span><span><i style="background:#9db0ea"></i>เส้นสนาม B</span></div>');
  RO = U.readouts('ค่าที่คำนวณได้', [['r', 'รัศมี r = mv⊥/qB'], ['T', 'คาบ T = 2πm/qB'], ['f', 'ความถี่ไซโคลตรอน'], ['p', 'ระยะพิตช์ p = v∥T'], ['F', 'แรง F = qvB sinθ'], ['K', 'พลังงานจลน์ (คงที่)']]);
  LIVE = U.readouts('ขณะเคลื่อนที่', [['x', 'ตำแหน่ง x'], ['z', 'ตำแหน่ง z'], ['vx', 'ความเร็ว vₓ'], ['vz', 'ความเร็ว v_z'], ['vy', 'ความเร็ว v_y (ขนาน B)'], ['sp', 'อัตราเร็ว |v|']]);
  U.note('สังเกต: ปรับ v แล้วคาบ T ไม่เปลี่ยน · ลด θ เป็น 0° แรงหายไป · vₓ และ v_z เปลี่ยนตลอดแต่ |v| คงที่ เพราะแรงแม่เหล็กไม่ทำงาน');
  refresh();

  let acc = 1;
  host.onUpdate(dt => {
    const k = phys(), s = Math.sign(k.T.q);
    const wv = 1.6 * (k.q / k.T.m) / (e / mp) * st.B;      // visual angular speed ∝ qB/m
    const Rv = k.R * 1000, rv = k.r * 1000, vpar = wv * Rv * Math.cos(k.th);
    if (st.play) { st.phi += wv * dt; st.y += vpar * dt; if (st.y > YL) { st.y = -YL; clear(); } }
    const c = Math.cos(st.phi), sn = Math.sin(st.phi);
    const x = rv * c, z = s * rv * sn;
    ball.position.set(x, st.y, z);
    if (st.play) {
      if (tc < TN) { tp[tc * 3] = x; tp[tc * 3 + 1] = st.y; tp[tc * 3 + 2] = z; tc++; }
      else { tp.copyWithin(0, 3); tp[(TN - 1) * 3] = x; tp[(TN - 1) * 3 + 1] = st.y; tp[(TN - 1) * 3 + 2] = z; }
      tg.attributes.position.needsUpdate = true; tg.setDrawRange(0, tc);
    }
    const vd = new THREE.Vector3(-rv * wv * sn, vpar, s * rv * wv * c);
    if (vd.lengthSq() < 1e-12) vd.set(0, 1, 0);
    vA.position.copy(ball.position); vA.setDirection(vd.normalize());
    if (rv > 1e-6 && k.th > 1e-4) { fA.visible = true; fA.position.copy(ball.position); fA.setDirection(new THREE.Vector3(-c, 0, -s * sn)); }
    else fA.visible = false;
    acc += dt;
    if (acc > 0.07) {
      acc = 0; const vperp = st.v * Math.sin(k.th);
      LIVE.x.textContent = fx(x, 3) + ' mm';
      LIVE.z.textContent = fx(z, 3) + ' mm';
      LIVE.vx.textContent = fx(-vperp * sn / 1e5, 3) + ' × 10⁵ m/s';
      LIVE.vz.textContent = fx(s * vperp * c / 1e5, 3) + ' × 10⁵ m/s';
      LIVE.vy.textContent = fx(st.v * Math.cos(k.th) / 1e5, 3) + ' × 10⁵ m/s';
      LIVE.sp.textContent = (st.v / 1e5).toFixed(3) + ' × 10⁵ m/s';
    }
  });
  const api = { toggle() { st.play = !st.play; return st.play; } };
  return api;
}
