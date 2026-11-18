/* ─────────── Sim 4 : radioactive decay ─────────── */
function simNuclear(host, U) {
  const { world } = host;
  host.setHome(new THREE.Vector3(14, 10, 16), new THREE.Vector3(0, 0, 0));
  const st = { side: 10, T: 4, speed: 1, play: true, t: 0, mode: 'a', N0: 0, N: 0, done: false };
  const geo = new THREE.SphereGeometry(0.27, 14, 10), mat = new THREE.MeshStandardMaterial({ roughness: 0.5 });
  const cP = new THREE.Color(0xe6a845), cD = new THREE.Color(0xb3afa6), dummy = new THREE.Object3D();
  let mesh = null, alive = null, pos = null, hist = [];
  let api = null;
  function build() {
    if (mesh) { world.remove(mesh); mesh.dispose(); }
    const n = st.side, N = n * n * n, sp = 0.78, off = (n - 1) * sp / 2;
    mesh = new THREE.InstancedMesh(geo, mat, N); pos = new Float32Array(N * 3); alive = new Uint8Array(N).fill(1);
    let i = 0;
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) {
      const px = x * sp - off, py = y * sp - off, pz = z * sp - off; pos[i * 3] = px; pos[i * 3 + 1] = py; pos[i * 3 + 2] = pz;
      dummy.position.set(px, py, pz); dummy.scale.setScalar(1); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, cP); i++;
    }
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; world.add(mesh);
    st.N0 = N; st.N = N; st.t = 0; st.done = false; hist = [[0, N]];
    pool.forEach(p => p.m.visible = false);
    if (!st.play && api) { st.play = true; api.onPlayChange && api.onPlayChange(true); }
    drawChart(); refresh();
  }
  const pool = [];
  for (let i = 0; i < 70; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({ color: 0xd94a3a, transparent: true })); m.visible = false; world.add(m); pool.push({ m, v: new THREE.Vector3(), life: 0, max: 1 }); }
  function emit(i) {
    const p = pool.find(o => !o.m.visible); if (!p) return;
    const a = st.mode === 'a';
    p.m.position.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    p.v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(a ? 4.5 : 9);
    p.life = p.max = a ? 0.9 : 0.7; p.m.material.color.setHex(a ? 0xd94a3a : 0x3a6fd9); p.m.scale.setScalar(a ? 1.4 : 0.7); p.m.material.opacity = 1; p.m.visible = true;
  }

  U.head('การสลายของนิวเคลียสกัมมันตรังสี', 'ทรงกลมสีส้ม = นิวเคลียสตั้งต้น · สีเทา = นิวเคลียสลูก');
  U.group('ชนิดการสลาย');
  const eqb = { el: null }; let eqn = null;
  U.seg({ value: 'a', options: [['a', 'แอลฟา (α)'], ['b', 'บีตาลบ (β⁻)']] }, v => {
    st.mode = v;
    if (eqb.el) { eqb.el.innerHTML = v === 'a' ? String.raw`\({}^{226}_{88}\mathrm{Ra} \to {}^{222}_{86}\mathrm{Rn} + {}^{4}_{2}\mathrm{He}\)` : String.raw`\({}^{14}_{6}\mathrm{C} \to {}^{14}_{7}\mathrm{N} + {}^{\;0}_{-1}e + \bar\nu_e\)`; typeset(eqb.el); }
    if (eqn) eqn.textContent = v === 'a' ? 'ตัวอย่างจริง: Ra-226 มีครึ่งชีวิตราว 1,600 ปี (ในการจำลองย่อเวลาลง)' : 'ตัวอย่างจริง: C-14 มีครึ่งชีวิตราว 5,730 ปี (ในการจำลองย่อเวลาลง)';
  });
  eqb.el = U.html('<div class="eqbox"></div>');
  eqn = U.html('<div class="p-sub" style="margin-top:6px"></div>');
  eqb.el.innerHTML = String.raw`\({}^{226}_{88}\mathrm{Ra} \to {}^{222}_{86}\mathrm{Rn} + {}^{4}_{2}\mathrm{He}\)`;
  eqn.textContent = 'ตัวอย่างจริง: Ra-226 มีครึ่งชีวิตราว 1,600 ปี (ในการจำลองย่อเวลาลง)';
  U.group('พารามิเตอร์');
  U.slider({ label: 'ครึ่งชีวิต T½ (เวลาจำลอง)', min: 1, max: 10, step: 0.5, value: 4, fmt: x => x.toFixed(1) + ' s' }, x => { st.T = x; if (mesh) build(); });
  U.seg({ label: 'จำนวนนิวเคลียสเริ่มต้น N₀', value: '10', options: [['5', '125'], ['8', '512'], ['10', '1000'], ['12', '1728']] }, v => { st.side = +v; if (mesh) build(); });
  U.slider({ label: 'ความเร็วเวลา', min: 0.25, max: 4, step: 0.25, value: 1, fmt: x => '×' + x.toFixed(2) }, x => { st.speed = x; });
  const rbtn = U.html('<button class="btn btn-ghost btn-sm" style="margin-top:4px">↺ เริ่มใหม่</button>'); rbtn.onclick = () => build();
  U.group('จำนวนนิวเคลียสที่เหลือ เทียบกับทฤษฎี');
  const cv = U.html('<canvas class="chart"></canvas>');
  U.html('<div class="legend"><span><i style="background:#2b8a4e"></i>ผลการจำลอง</span><span><i style="background:#a19d94"></i>N₀(½)^(t/T½)</span></div>');
  const RO = U.readouts('ค่าขณะนี้', [['t', 'เวลา t'], ['h', 'จำนวนครึ่งชีวิต t/T½'], ['N', 'N ที่เหลือ'], ['p', 'N / N₀'], ['th', 'ทฤษฎี N₀(½)^(t/T½)'], ['lam', 'λ = 0.693/T½'], ['A', 'กัมมันตภาพ A = λN']]);
  U.note('การสลายของแต่ละนิวเคลียสสุ่มทั้งหมด แต่เมื่อมีจำนวนมาก กราฟจะเกาะเส้นทฤษฎี ลองเลือก N₀ = 125 แล้วเทียบกับ 1728 ว่าความผันผวนต่างกันแค่ไหน');

  function refresh() {
    const th = st.N0 * Math.pow(0.5, st.t / st.T), lam = Math.LN2 / st.T;
    RO.t.textContent = st.t.toFixed(2) + ' s';
    RO.h.textContent = (st.t / st.T).toFixed(2);
    RO.N.textContent = st.N + ' / ' + st.N0;
    RO.p.textContent = (100 * st.N / st.N0).toFixed(1) + ' %';
    RO.th.textContent = th.toFixed(1);
    RO.lam.textContent = lam.toFixed(4) + ' s⁻¹';
    RO.A.textContent = (lam * st.N).toFixed(1) + ' Bq';
  }
  function drawChart() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth || 300, H = cv.clientHeight || 180;
    cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const l = 40, r = 12, t = 12, b = 26, TT = 5 * st.T;
    const X = v => l + v / TT * (W - l - r), Y = n => t + (1 - n / st.N0) * (H - t - b);
    g.font = '10px "JetBrains Mono", monospace'; g.fillStyle = '#8a8e98'; g.strokeStyle = '#ddd9d0'; g.lineWidth = 1;
    [[1, 'N₀'], [0.5, 'N₀/2'], [0.25, 'N₀/4'], [0.125, 'N₀/8']].forEach(([f, s]) => { const y = Y(st.N0 * f); g.setLineDash([2, 3]); g.beginPath(); g.moveTo(l, y); g.lineTo(W - r, y); g.stroke(); g.setLineDash([]); g.textAlign = 'right'; g.fillText(s, l - 5, y + 3); });
    g.textAlign = 'center';
    for (let k = 0; k <= 5; k++) { const x = X(k * st.T); g.beginPath(); g.moveTo(x, H - b); g.lineTo(x, H - b + 4); g.stroke(); g.fillText(k === 0 ? '0' : k + 'T½', x, H - 8); }
    g.strokeStyle = '#a19d94'; g.setLineDash([4, 4]); g.lineWidth = 1.5; g.beginPath();
    for (let s = 0; s <= 120; s++) { const tt = s / 120 * TT, y = Y(st.N0 * Math.pow(0.5, tt / st.T)); s ? g.lineTo(X(tt), y) : g.moveTo(X(tt), y); } g.stroke(); g.setLineDash([]);
    g.strokeStyle = '#2b8a4e'; g.lineWidth = 2; g.beginPath(); hist.forEach(([tt, n], k) => k ? g.lineTo(X(tt), Y(n)) : g.moveTo(X(tt), Y(n))); g.stroke();
    const lp = hist[hist.length - 1]; g.fillStyle = '#2b8a4e'; g.beginPath(); g.arc(X(lp[0]), Y(lp[1]), 3.5, 0, Math.PI * 2); g.fill();
  }
  build();

  let acc = 0;
  host.onUpdate(dt => {
    if (st.play && !st.done) {
      const ds = dt * st.speed; st.t += ds; const p = 1 - Math.pow(2, -ds / st.T); let ch = false;
      for (let i = 0; i < st.N0; i++) {
        if (alive[i] && Math.random() < p) {
          alive[i] = 0; st.N--; ch = true; mesh.setColorAt(i, cD);
          dummy.position.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); dummy.scale.setScalar(0.8); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
          if (Math.random() < 0.4) emit(i);
        }
      }
      if (ch) { mesh.instanceColor.needsUpdate = true; mesh.instanceMatrix.needsUpdate = true; }
      if (st.t - hist[hist.length - 1][0] >= st.T / 40) hist.push([st.t, st.N]);
      if (st.t >= 5 * st.T) { st.done = true; hist.push([st.t, st.N]); st.play = false; api.onPlayChange && api.onPlayChange(false); drawChart(); refresh(); }
    }
    pool.forEach(p => { if (!p.m.visible) return; p.life -= dt; p.m.position.addScaledVector(p.v, dt); p.m.material.opacity = Math.max(0, p.life / p.max); if (p.life <= 0) p.m.visible = false; });
    acc += dt; if (acc > 0.12) { acc = 0; refresh(); drawChart(); }
  });
  api = { toggle() { if (st.done) { build(); return true; } st.play = !st.play; return st.play; } };
  return api;
}
