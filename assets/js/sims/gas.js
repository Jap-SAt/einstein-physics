/* ─────────── Sim : ideal gas in a box with a piston (บทที่ 02 อุณหพลศาสตร์) ───────────
   Hard-sphere-free point particles bounce elastically off the walls. Pressure is measured from the
   momentum delivered to the walls and compared with kinetic theory  P = N m⟨v²⟩ / 3V.
   Visual speed scale: per-component σ = 2.0·√(T/300 K)·√(28/M) units/s, so N₂ at 300 K has σ = 2. */
function simGas(host, U) {
  const { world } = host;
  host.setHome(new THREE.Vector3(17, 13, 20), new THREE.Vector3(0, 6, 0));
  const GAS = { he: ['ฮีเลียม (He)', 4], n2: ['ไนโตรเจน (N₂)', 28], co2: ['คาร์บอนไดออกไซด์ (CO₂)', 44] };
  const kB = 1.380649e-23, Rg = 8.314462618;
  const L = 10, HALF = 5, MAXN = 400;
  const st = { N: 200, T: 300, M: 28, Ht: 10, H: 10, Vp: 0, mode: 'iso', play: true };
  const sig = (T, M) => 2.0 * Math.sqrt(T / 300) * Math.sqrt(28 / M);
  const pos = new Float32Array(MAXN * 3), vel = new Float32Array(MAXN * 3);
  let seed = 99; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const gauss = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * rnd()); };
  function init() {
    const s = sig(st.T, st.M);
    for (let i = 0; i < MAXN; i++) {
      pos[i * 3] = (rnd() - 0.5) * (L - 0.4); pos[i * 3 + 1] = 0.2 + rnd() * (st.H - 0.4); pos[i * 3 + 2] = (rnd() - 0.5) * (L - 0.4);
      vel[i * 3] = gauss() * s; vel[i * 3 + 1] = gauss() * s; vel[i * 3 + 2] = gauss() * s;
    }
    Pm = 0;
  }
  const dark = isDark();
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshStandardMaterial({ roughness: 0.4 }), MAXN);
  world.add(mesh);
  const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: dark ? 0x6b6e76 : 0x9a968e }));
  world.add(box);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L, L), new THREE.MeshBasicMaterial({ color: dark ? 0x1a1b20 : 0xefece5, side: THREE.DoubleSide }));
  floor.rotation.x = -Math.PI / 2; world.add(floor);
  const piston = new THREE.Mesh(new THREE.BoxGeometry(L, 0.3, L), new THREE.MeshStandardMaterial({ color: 0xc0396b, transparent: true, opacity: 0.35, roughness: 0.6 }));
  world.add(piston);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 8, 16), new THREE.MeshStandardMaterial({ color: dark ? 0x8f939c : 0x6b6f78, roughness: 0.5 }));
  world.add(rod);
  const dummy = new THREE.Object3D(), cSlow = new THREE.Color(0x3a6fd9), cFast = new THREE.Color(0xe8743b), cTmp = new THREE.Color();
  let Pm = 0, Tm = 300, v2 = 0;

  function measure() {
    let s = 0; for (let i = 0; i < st.N * 3; i++) s += vel[i] * vel[i];
    v2 = s / st.N; Tm = 300 * (st.M / 28) * (v2 / 3) / 4;
  }

  let RO = null, LIVE = null, tSlider = null, cv = null;
  U.head('แก๊สอุดมคติในกระบอกสูบ', 'ความดันวัดจากแรงที่โมเลกุลชนผนังจริง ๆ ในการจำลอง');
  U.group('ชนิดแก๊ส');
  U.seg({ value: 'n2', options: [['he', 'He'], ['n2', 'N₂'], ['co2', 'CO₂']] }, v => {
    const Mn = GAS[v][1], f = Math.sqrt(st.M / Mn);       // same temperature → lighter gas moves faster
    for (let i = 0; i < MAXN * 3; i++) vel[i] *= f;
    st.M = Mn;
  });
  U.group('กระบวนการ');
  U.seg({ value: 'iso', options: [['iso', 'ควบคุมอุณหภูมิ'], ['adi', 'หุ้มฉนวน (Q = 0)']] }, v => {
    st.mode = v; if (tSlider) { tSlider.disabled = v === 'adi'; if (v === 'iso') tSlider.setValue(Math.round(Tm / 10) * 10); }
  });
  tSlider = U.slider({ label: 'อุณหภูมิ T (เมื่อควบคุม)', min: 100, max: 1000, step: 10, value: 300, fmt: x => x + ' K' }, x => { st.T = x; });
  U.slider({ label: 'ตำแหน่งลูกสูบ (ปริมาตร)', min: 4, max: 16, step: 0.1, value: 10, fmt: x => (x * L * L).toFixed(0) + ' หน่วย³' }, x => { st.Ht = x; });
  U.seg({ label: 'จำนวนโมเลกุล N', value: '200', options: [['60', '60'], ['200', '200'], ['400', '400']] }, v => { st.N = +v; mesh.count = st.N; init(); });
  U.html('<div class="ctl-row" style="margin-top:16px"><label>การกระจายอัตราเร็ว (แมกซ์เวลล์–โบลตซ์มันน์)</label></div>');
  cv = U.html('<canvas class="chart" style="height:150px"></canvas>');
  U.html('<div class="legend"><span><i style="background:#c0396b"></i>จำนวนจากการจำลอง</span><span><i style="background:#a19d94"></i>เส้นทฤษฎี</span><span><i style="background:#3a6fd9"></i>ช้า</span><span><i style="background:#e8743b"></i>เร็ว</span></div>');
  RO = U.readouts('ค่าทางฟิสิกส์ (แก๊สจริง)', [['T', 'อุณหภูมิ T'], ['vrms', 'v_rms = √(3RT/M)'], ['ek', 'Eₖ เฉลี่ย = 3/2 kT'], ['tv', 'T·V^(2/3) (คงที่เมื่อ Q = 0)']]);
  LIVE = U.readouts('ในการจำลอง', [['pm', 'P จากการชนผนัง'], ['pt', 'P = Nm⟨v²⟩/3V'], ['ratio', 'อัตราส่วน (ควร ≈ 1)'], ['v', 'ปริมาตร V']]);
  U.note('ลองโหมด “หุ้มฉนวน” แล้วกดลูกสูบลงเร็ว ๆ: แก๊สร้อนขึ้นเองเพราะได้รับงาน (Q = ΔU + W, Q = 0) · แก๊สในภาพเป็นอนุภาคจุด จึงเทียบกับ γ = 5/3 ของแก๊สอะตอมเดี่ยว');
  init(); mesh.count = st.N;

  function drawHist() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth || 300, H = cv.clientHeight || 150;
    cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const s = Math.sqrt(v2 / 3) || 1, vmax = 4.4 * s, B = 22, bins = new Array(B).fill(0), l = 10, r = 10, t = 10, b = 20;
    for (let i = 0; i < st.N; i++) { const v = Math.hypot(vel[i * 3], vel[i * 3 + 1], vel[i * 3 + 2]); const k = Math.floor(v / vmax * B); if (k < B) bins[k]++; }
    const pdf = v => Math.sqrt(2 / Math.PI) * v * v / (s * s * s) * Math.exp(-v * v / (2 * s * s));
    const peak = pdf(Math.SQRT2 * s) * st.N * vmax / B * 1.35;
    const X = v => l + v / vmax * (W - l - r), Y = n => H - b - n / peak * (H - t - b);
    g.fillStyle = 'rgba(192,57,107,.55)';
    bins.forEach((n, k) => { const x0 = X(k * vmax / B), x1 = X((k + 1) * vmax / B); g.fillRect(x0 + 1, Y(n), x1 - x0 - 2, H - b - Y(n)); });
    g.strokeStyle = '#a19d94'; g.lineWidth = 2; g.beginPath();
    for (let q = 0; q <= 80; q++) { const v = q / 80 * vmax, y = Y(pdf(v) * st.N * vmax / B); q ? g.lineTo(X(v), y) : g.moveTo(X(v), y); } g.stroke();
    g.fillStyle = '#8a8e98'; g.font = '10px "JetBrains Mono", monospace'; g.textAlign = 'center';
    const vr = Math.sqrt(3 * Rg * Tm / (st.M / 1000));
    [0, 1, 2, 3, 4].forEach(q => g.fillText(Math.round(q * s * vr / Math.sqrt(v2 || 1)) + '', X(q * s), H - 6));
    g.textAlign = 'right'; g.fillText('m/s', W - 2, H - 6);
  }

  let acc = 1;
  host.onUpdate(dt => {
    const dH = Math.max(-3 * dt, Math.min(3 * dt, st.Ht - st.H));
    st.Vp = dt > 0 ? dH / dt : 0; st.H += dH;
    const m = st.M / 28, A = 2 * L * L + 4 * L * st.H;
    let imp = 0;
    if (st.play) {
      const sub = 3, h = dt / sub;
      for (let s = 0; s < sub; s++) {
        for (let i = 0; i < st.N; i++) {
          const j = i * 3;
          pos[j] += vel[j] * h; pos[j + 1] += vel[j + 1] * h; pos[j + 2] += vel[j + 2] * h;
          if (pos[j] < -HALF) { pos[j] = -HALF; if (vel[j] < 0) { imp += 2 * m * -vel[j]; vel[j] = -vel[j]; } }
          else if (pos[j] > HALF) { pos[j] = HALF; if (vel[j] > 0) { imp += 2 * m * vel[j]; vel[j] = -vel[j]; } }
          if (pos[j + 2] < -HALF) { pos[j + 2] = -HALF; if (vel[j + 2] < 0) { imp += 2 * m * -vel[j + 2]; vel[j + 2] = -vel[j + 2]; } }
          else if (pos[j + 2] > HALF) { pos[j + 2] = HALF; if (vel[j + 2] > 0) { imp += 2 * m * vel[j + 2]; vel[j + 2] = -vel[j + 2]; } }
          if (pos[j + 1] < 0) { pos[j + 1] = 0; if (vel[j + 1] < 0) { imp += 2 * m * -vel[j + 1]; vel[j + 1] = -vel[j + 1]; } }
          else if (pos[j + 1] > st.H) {
            pos[j + 1] = st.H; const rel = vel[j + 1] - st.Vp;
            if (rel > 0) { imp += 2 * m * rel; vel[j + 1] = 2 * st.Vp - vel[j + 1]; }   // moving wall: does work on the gas
          }
        }
      }
      measure();
      if (st.mode === 'iso' && Tm > 0) {                    // heat bath gently pulls T toward the setting
        const f = 1 + (Math.sqrt(st.T / Tm) - 1) * Math.min(1, dt * 2.5);
        for (let i = 0; i < st.N * 3; i++) vel[i] *= f;
        measure();
      }
      const Pinst = dt > 0 ? imp / (A * dt) : 0;
      Pm += (Pinst - Pm) * Math.min(1, dt / 1.5);
    }
    // visuals
    const sNow = Math.sqrt(v2 / 3) || 1;
    for (let i = 0; i < st.N; i++) {
      dummy.position.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      const sp = Math.hypot(vel[i * 3], vel[i * 3 + 1], vel[i * 3 + 2]) / (sNow * 2.6);
      cTmp.copy(cSlow).lerp(cFast, Math.min(1, sp)); mesh.setColorAt(i, cTmp);
    }
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    box.scale.set(L, st.H, L); box.position.y = st.H / 2;
    piston.position.y = st.H + 0.15; rod.position.y = st.H + 4.3;
    acc += dt;
    if (acc > 0.15) {
      acc = 0;
      const V = L * L * st.H, Pth = st.N * m * v2 / 3 / V;
      RO.T.textContent = Tm.toFixed(0) + ' K';
      RO.vrms.textContent = Math.sqrt(3 * Rg * Tm / (st.M / 1000)).toFixed(0) + ' m/s';
      RO.ek.textContent = sci(1.5 * kB * Tm, 3) + ' J';
      RO.tv.textContent = (Tm * Math.pow(V, 2 / 3)).toFixed(0);
      LIVE.pm.textContent = Pm.toFixed(3);
      LIVE.pt.textContent = Pth.toFixed(3);
      LIVE.ratio.textContent = Pth > 0 ? (Pm / Pth).toFixed(3) : '—';
      LIVE.v.textContent = V.toFixed(0) + ' หน่วย³';
      if (st.mode === 'adi' && tSlider) tSlider.previousElementSibling.querySelector('.ctl-val').textContent = Tm.toFixed(0) + ' K (วัดได้)';
      drawHist();
    }
  });
  return { toggle() { st.play = !st.play; return st.play; } };
}
