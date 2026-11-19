/* ─────────── Sim : two-source interference in a ripple tank (บทที่ 03 คลื่นและทัศนศาสตร์) ───────────
   h(P,t) = Σ A sin(k rᵢ − ωt + φᵢ) / √(1 + 0.12 rᵢ)   (mild spreading loss so far waves look calmer)
   Nodal lines: r₁ − r₂ = (n + ½ + φ/2π) λ   → hyperbolas with the two sources as foci.
   1 unit in the scene = 1 cm. Wave speed v = 6 cm/s. */
function simRipple(host, U) {
  const { world, camera, renderer } = host;
  host.setHome(new THREE.Vector3(0, 30, 30), new THREE.Vector3(0, 0, 0));
  // the height field is computed on the CPU every frame: use a lighter mesh on phones/tablets
  const lowPower = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || innerWidth < 900;
  const SIZE = 44, SEG = lowPower ? 120 : 200, V = 6;
  const st = { lam: 4, d: 10, phi: 0, A: 1, two: true, lines: true, play: true, t: 0, probe: new THREE.Vector3(8, 0, 12) };
  const dark = isDark();
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
  const P = geo.attributes.position, NV = P.count;
  const colors = new Float32Array(NV * 3); geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const water = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  world.add(water);
  const lo = dark ? [0.03, 0.12, 0.22] : [0.10, 0.36, 0.60], mid = dark ? [0.08, 0.30, 0.46] : [0.42, 0.70, 0.88], hi = dark ? [0.55, 0.85, 1.0] : [0.92, 0.98, 1.0];
  const srcMat = new THREE.MeshStandardMaterial({ color: 0x1f7fb8, roughness: 0.35 });
  const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 14), srcMat), s2 = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 14), srcMat);
  world.add(s1, s2);
  const l1 = makeLabel('S₁', '#1f7fb8', 1.3), l2 = makeLabel('S₂', '#1f7fb8', 1.3); world.add(l1, l2);
  const probeM = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.3, 16), new THREE.MeshStandardMaterial({ color: 0xd0602a })); probeM.rotation.x = Math.PI; world.add(probeM);
  const pl = makeLabel('P', '#d0602a', 1.3); world.add(pl);
  const nodal = new THREE.Group(); world.add(nodal);

  function buildLines() {
    nodal.children.slice().forEach(c => { nodal.remove(c); c.geometry.dispose(); c.material.dispose(); });
    if (!st.two || !st.lines) return;
    const c = st.d / 2, shift = st.phi / (2 * Math.PI), H = SIZE / 2;
    for (let n = -20; n <= 20; n++) {
      const D = (n + 0.5 + shift) * st.lam;               // required path difference r1 − r2
      if (Math.abs(D) >= st.d - 1e-6) continue;
      const a = D / 2, b = Math.sqrt(c * c - a * a), pts = [];
      for (let q = -60; q <= 60; q++) {
        const sh = q / 60 * 4, x = a * Math.cosh(sh), z = b * Math.sinh(sh);
        if (Math.abs(x) > H || Math.abs(z) > H) continue;
        pts.push(new THREE.Vector3(x, 1.25, z));
      }
      if (pts.length < 2) continue;
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(g, new THREE.LineDashedMaterial({ color: dark ? 0xff9d7a : 0xc0392b, dashSize: 0.5, gapSize: 0.35 }));
      line.computeLineDistances(); nodal.add(line);
    }
  }
  function lineCounts() {
    const shift = st.phi / (2 * Math.PI); let nod = 0, anti = 0;
    for (let n = -40; n <= 40; n++) { if (Math.abs((n + 0.5 + shift) * st.lam) < st.d) nod++; if (Math.abs((n + shift) * st.lam) < st.d) anti++; }
    return { nod, anti };
  }

  let RO = null, LIVE = null;
  function refresh() {
    s1.position.set(-st.d / 2, 0.6, 0); s2.position.set(st.d / 2, 0.6, 0); s2.visible = l2.visible = st.two;
    l1.position.set(-st.d / 2, 2.2, 0); l2.position.set(st.d / 2, 2.2, 0);
    probeM.position.set(st.probe.x, 2.2, st.probe.z); pl.position.set(st.probe.x, 3.6, st.probe.z);
    buildLines();
    if (!RO) return;
    const f = V / st.lam, lc = lineCounts();
    RO.lam.textContent = st.lam.toFixed(2) + ' cm';
    RO.f.textContent = f.toFixed(2) + ' Hz';
    RO.v.textContent = V.toFixed(1) + ' cm/s';
    RO.d.textContent = st.two ? (st.d / st.lam).toFixed(2) : '—';
    RO.nn.textContent = st.two ? String(lc.nod) : '—';
    RO.na.textContent = st.two ? String(lc.anti) : '—';
  }

  U.head('การแทรกสอดของคลื่นผิวน้ำจากสองแหล่ง', 'แหล่งกำเนิดอาพันธ์ · 1 หน่วยในภาพ = 1 cm · คลิกบนผิวน้ำเพื่อย้ายจุด P');
  U.group('แหล่งกำเนิด');
  U.seg({ value: 'two', options: [['one', 'แหล่งเดียว'], ['two', 'สองแหล่ง']] }, v => { st.two = v === 'two'; refresh(); });
  U.slider({ label: 'ความยาวคลื่น λ', min: 1.5, max: 8, step: 0.1, value: 4, fmt: x => x.toFixed(1) + ' cm' }, x => { st.lam = x; refresh(); });
  U.slider({ label: 'ระยะห่างแหล่ง d', min: 2, max: 20, step: 0.1, value: 10, fmt: x => x.toFixed(1) + ' cm' }, x => { st.d = x; refresh(); });
  U.slider({ label: 'เฟสของ S₂ เทียบ S₁ (φ)', min: 0, max: 360, step: 5, value: 0, fmt: x => x + '°' }, x => { st.phi = x * Math.PI / 180; refresh(); });
  U.slider({ label: 'แอมพลิจูด', min: 0.3, max: 1.6, step: 0.05, value: 1, fmt: x => x.toFixed(2) + ' cm' }, x => { st.A = x; });
  U.check('แสดงแนวบัพ (หักล้าง)', true, v => { st.lines = v; refresh(); });
  RO = U.readouts('ค่าของคลื่น', [['lam', 'ความยาวคลื่น λ'], ['f', 'ความถี่ f = v/λ'], ['v', 'อัตราเร็ว v'], ['d', 'd / λ'], ['nn', 'จำนวนแนวบัพ'], ['na', 'จำนวนแนวปฏิบัพ']]);
  LIVE = U.readouts('ที่จุด P', [['r1', 'S₁P'], ['r2', 'S₂P'], ['dr', '|S₁P − S₂P|'], ['drl', 'ผลต่างทางเดิน (เท่าของ λ)'], ['type', 'ผลการแทรกสอด'], ['amp', 'แอมพลิจูดลัพธ์'], ['h', 'ระดับน้ำ h(t)']]);
  U.note('เมื่อ φ = 0: ผลต่างทางเดินเป็น nλ → เสริม (ปฏิบัพ), เป็น (n + ½)λ → หักล้าง (บัพ) · ลองเพิ่ม d หรือลด λ แล้วนับจำนวนแนวบัพที่เพิ่มขึ้น');
  refresh();

  // click (not drag) on the water moves P
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), flat = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let down = null;
  const onDown = e => { down = [e.clientX, e.clientY]; };
  const onUp = e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) { down = null; return; }
    down = null;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(flat, hit)) {
      world.worldToLocal(hit);
      if (Math.abs(hit.x) < SIZE / 2 && Math.abs(hit.z) < SIZE / 2) { st.probe.set(hit.x, 0, hit.z); refresh(); }
    }
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);

  const height = (x, z, t) => {
    const k = 2 * Math.PI / st.lam, w = k * V;
    const r1 = Math.hypot(x + st.d / 2, z);
    let h = st.A * Math.sin(k * r1 - w * t) / Math.sqrt(1 + 0.12 * r1);
    if (st.two) { const r2 = Math.hypot(x - st.d / 2, z); h += st.A * Math.sin(k * r2 - w * t + st.phi) / Math.sqrt(1 + 0.12 * r2); }
    return h;
  };
  let acc = 1;
  host.onUpdate(dt => {
    if (st.play) st.t += dt;
    const t = st.t, amax = st.A * (st.two ? 2 : 1);
    for (let i = 0; i < NV; i++) {
      const x = P.getX(i), z = P.getZ(i), h = height(x, z, t);
      P.setY(i, h * 0.55);
      const u = Math.max(-1, Math.min(1, h / amax)), j = i * 3;
      if (u < 0) { const a = -u; colors[j] = mid[0] + (lo[0] - mid[0]) * a; colors[j + 1] = mid[1] + (lo[1] - mid[1]) * a; colors[j + 2] = mid[2] + (lo[2] - mid[2]) * a; }
      else { colors[j] = mid[0] + (hi[0] - mid[0]) * u; colors[j + 1] = mid[1] + (hi[1] - mid[1]) * u; colors[j + 2] = mid[2] + (hi[2] - mid[2]) * u; }
    }
    P.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    const bob = Math.sin(-2 * Math.PI / st.lam * V * t) * 0.3;
    s1.position.y = 0.6 + bob; s2.position.y = 0.6 + Math.sin(-2 * Math.PI / st.lam * V * t + st.phi) * 0.3;
    acc += dt;
    if (acc > 0.07) {
      acc = 0;
      const x = st.probe.x, z = st.probe.z, r1 = Math.hypot(x + st.d / 2, z), r2 = Math.hypot(x - st.d / 2, z);
      LIVE.r1.textContent = r1.toFixed(2) + ' cm';
      LIVE.r2.textContent = st.two ? r2.toFixed(2) + ' cm' : '—';
      LIVE.h.textContent = fx(height(x, z, t), 3) + ' cm';
      if (st.two) {
        const dr = r1 - r2, k = 2 * Math.PI / st.lam;
        let dl = ((k * dr - st.phi) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);   // effective phase difference
        const amp = 2 * st.A * Math.abs(Math.cos(dl / 2));
        const near = Math.min(dl, 2 * Math.PI - dl);
        LIVE.dr.textContent = Math.abs(dr).toFixed(2) + ' cm';
        LIVE.drl.textContent = (Math.abs(dr) / st.lam).toFixed(2) + ' λ';
        LIVE.type.textContent = near < 0.35 ? 'เสริมกัน (ปฏิบัพ)' : Math.abs(near - Math.PI) < 0.35 ? 'หักล้างกัน (บัพ)' : 'เสริมกันบางส่วน';
        LIVE.amp.textContent = '≈ ' + amp.toFixed(2) + ' cm';
      } else { ['dr', 'drl', 'amp'].forEach(k => LIVE[k].textContent = '—'); LIVE.type.textContent = 'แหล่งเดียว ไม่มีการแทรกสอด'; }
    }
  });
  return {
    toggle() { st.play = !st.play; return st.play; },
    dispose() { renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointerup', onUp); }
  };
}
