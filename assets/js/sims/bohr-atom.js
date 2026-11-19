/* ─────────── Sim 3 : Bohr hydrogen atom ─────────── */
function simAtom(host, U) {
  const { world, scene } = host;
  const c0 = 299792458;
  host.setHome(new THREE.Vector3(0, 30, 38), new THREE.Vector3(0, 0, 0));
  const RS = 0.7, NMAX = 6, R = n => RS * n * n, En = n => -13.6 / (n * n);
  const SERIES = { 1: 'ไลมาน', 2: 'บาลเมอร์', 3: 'พาสเชน', 4: 'แบรคเกตต์', 5: 'ฟุนด์' };
  const nuc = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 16), new THREE.MeshStandardMaterial({ color: 0xd94a3a, roughness: 0.4 })); world.add(nuc);
  const pl = makeLabel('p⁺', '#d94a3a', 0.9); pl.position.set(0, 1.0, 0); world.add(pl);
  const rings = [];
  for (let n = 1; n <= NMAX; n++) {
    const pts = []; for (let k = 0; k <= 180; k++) { const a = k / 180 * Math.PI * 2; pts.push(new THREE.Vector3(R(n) * Math.cos(a), 0, R(n) * Math.sin(a))); }
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xc4bfb5, transparent: true, opacity: 0.9 }));
    world.add(ln); rings.push(ln);
    const lb = makeLabel('n=' + n, '#8a8e98', 0.75); const a = -0.75; lb.position.set(R(n) * Math.cos(a) + 0.4, 0.5, R(n) * Math.sin(a)); world.add(lb);
  }
  const elec = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 12), new THREE.MeshStandardMaterial({ color: 0x3a5bd9, emissive: 0x1d2f80, emissiveIntensity: 0.35, roughness: 0.3 })); world.add(elec);
  const st = { n: 1, r: R(1), phi: 0, play: true, busy: false, ion: false, out: 0 };
  const anims = [];
  function hlRing() { rings.forEach((r, i) => { const on = !st.ion && i + 1 === st.n; r.material.color.setHex(on ? 0x6a4cd6 : 0xc4bfb5); }); }
  hlRing();

  // photon visual
  const photons = [];
  function photonColor(nm) { const c = wl2rgb(nm); if (c) return new THREE.Color(c[0], c[1], c[2]); return new THREE.Color(nm < 380 ? 0x8a7fd0 : 0x9b3b3b); }
  function makePhoton(nm, from, dir, mode, onArrive) {
    const col = photonColor(nm), NP = 50, len = 3.2, wl = Math.min(2.2, Math.max(0.35, nm / 420));
    const geo = new THREE.BufferGeometry(); const arr = new Float32Array(NP * 3); geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.LineBasicMaterial({ color: col, transparent: true });
    const line = new THREE.Line(geo, mat); line.frustumCulled = false;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: col, transparent: true }));
    const g = new THREE.Group(); g.add(line, head); world.add(g);
    const ph = { g, geo, arr, mat, head, pos: from.clone(), dir: dir.clone().normalize(), life: 0, mode, onArrive, wl, len, NP, phase: 0 };
    photons.push(ph); return ph;
  }
  function updPhoton(p, dt) {
    p.life += dt; p.phase += dt * 14;
    if (p.mode === 'in') { const tgt = elec.position.clone(); const d = tgt.clone().sub(p.pos); const dist = d.length(); p.dir.copy(d.normalize()); const step = 16 * dt; if (dist <= step + 0.2) { p.done = true; p.onArrive && p.onArrive(); } else p.pos.addScaledVector(p.dir, step); }
    else { p.pos.addScaledVector(p.dir, 13 * dt); if (p.life > 2.6) p.done = true; p.mat.opacity = p.head.material.opacity = Math.max(0, Math.min(1, (2.6 - p.life) / 1.0)); }
    // build wiggle along -dir behind head (local frame)
    const up = Math.abs(p.dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const side = new THREE.Vector3().crossVectors(p.dir, up).normalize();
    for (let i = 0; i < p.NP; i++) {
      const s = i / (p.NP - 1) * p.len, amp = 0.32 * Math.sin(Math.PI * i / (p.NP - 1));
      const w = amp * Math.sin(2 * Math.PI * s / p.wl - p.phase);
      p.arr[i * 3] = p.pos.x - p.dir.x * s + side.x * w; p.arr[i * 3 + 1] = p.pos.y - p.dir.y * s + side.y * w; p.arr[i * 3 + 2] = p.pos.z - p.dir.z * s + side.z * w;
    }
    p.geo.attributes.position.needsUpdate = true; p.head.position.copy(p.pos);
  }
  function killPhoton(p) { world.remove(p.g); p.geo.dispose(); p.mat.dispose(); p.head.geometry.dispose(); p.head.material.dispose(); }

  function jump(to, dur = 0.7) {
    const r0 = st.r, r1 = R(to); let t = 0;
    anims.push(dt => { t += dt; const u = Math.min(1, t / dur), k = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; st.r = r0 + (r1 - r0) * k; if (u >= 1) { st.n = to; st.busy = false; hlRing(); showLevel(); setBtns(); return true; } return false; });
  }
  function radialDir() { const d = elec.position.clone(); d.y = 0; if (d.lengthSq() < 1e-6) d.set(1, 0, 0); d.normalize(); d.y = (Math.random() - 0.5) * 0.8; return d.normalize(); }

  const lines = []; // emitted λ
  function transition(target) {
    if (st.busy || st.ion || target === st.n) return;
    st.busy = true; setBtns();
    const ni = st.n, inf = target === Infinity;
    const Ei = En(ni), Ef = inf ? 0 : En(target), dE = Math.abs(Ef - Ei), nm = 1239.84 / dE;
    showTrans(ni, target, Ei, Ef, dE, nm);
    if (!inf && target < ni) {
      makePhoton(nm, elec.position.clone(), radialDir(), 'out');
      addLine(nm, ni, target); jump(target);
    } else {
      const d = radialDir(); const from = elec.position.clone().addScaledVector(d, 30);
      makePhoton(nm, from, d.clone().negate(), 'in', () => {
        if (inf) { st.ion = true; st.out = 0; anims.push(dt => { st.out += dt * 9 * (1 + st.out * 0.08); if (st.out > 45) { elec.visible = false; st.busy = false; hlRing(); showLevel(); setBtns(); return true; } return false; }); }
        else jump(target);
      });
    }
  }
  function resetAtom() {
    anims.length = 0;                                  // cancel pending jumps / ionisation fly-away
    photons.forEach(killPhoton); photons.length = 0;   // in-flight photons (and their onArrive) go too
    st.ion = false; st.out = 0; st.n = 1; st.r = R(1); st.busy = false;
    elec.visible = true; hlRing(); showLevel(); setBtns();
  }

  // ── panel
  U.head('อะตอมไฮโดรเจนตามแบบจำลองโบร์', 'คลิกระดับพลังงานเพื่อให้อิเล็กตรอนเปลี่ยนระดับ');
  U.group('แผนภาพระดับพลังงาน (ระยะห่างไม่ตามสเกล)');
  const lvBox = U.html(`<div class="levels">${['inf', 6, 5, 4, 3, 2, 1].map(n => `<button class="lv" data-n="${n}"><span>${n === 'inf' ? 'n = ∞ (หลุดออก)' : 'n = ' + n}</span><span class="mono">${n === 'inf' ? ' 0.00' : fx(En(n), 2)} eV</span></button>`).join('')}</div>`);
  lvBox.onclick = ev => { const b = ev.target.closest('.lv'); if (!b) return; const v = b.dataset.n; transition(v === 'inf' ? Infinity : +v); };
  const rb = U.html('<button class="btn btn-ghost btn-sm" style="margin-top:10px">↺ รีเซ็ตอะตอมกลับสู่สถานะพื้น</button>');
  rb.onclick = resetAtom;
  function setBtns() { lvBox.querySelectorAll('.lv').forEach(b => { const v = b.dataset.n; b.classList.toggle('on', !st.ion && String(st.n) === v); b.disabled = st.busy || st.ion; }); }
  const TR = U.readouts('การเปลี่ยนระดับล่าสุด', [['tr', 'n เริ่ม → n ปลาย'], ['kind', 'ชนิด'], ['dE', 'ΔE = |E_i − E_f|'], ['lam', 'λ = hc/ΔE'], ['f', 'ความถี่ f'], ['ser', 'อนุกรม'], ['reg', 'ช่วงคลื่น']]);
  U.group('เส้นสเปกตรัมการปล่อยที่สะสม (380–750 nm)');
  const strip = U.html('<div><div class="vstrip"></div><div class="vscale mono"><span>380</span><span>500</span><span>600</span><span>750 nm</span></div><div class="linelist"></div></div>');
  const cl = U.html('<button class="tool" style="margin-top:8px">ล้างเส้นสเปกตรัม</button>');
  cl.onclick = () => { lines.length = 0; drawLines(); };
  const LV = U.readouts('สถานะปัจจุบัน', [['n', 'ระดับ n'], ['E', 'พลังงาน E_n = −13.6/n²'], ['r', 'รัศมี r_n = 0.0529 n²'], ['v', 'อัตราเร็ว v_n'], ['L', 'โมเมนตัมเชิงมุม L'], ['xy', 'ตำแหน่ง (x, z)']]);
  U.note('ภาพนี้วาดรัศมีวงตามสัดส่วนจริง r ∝ n² แต่ความเร็วการหมุนในภาพลดลงมาก ลองทำ 3→2, 4→2, 5→2, 6→2 แล้วดูเส้นบาลเมอร์ทั้งสี่สีปรากฏ');

  function showTrans(ni, nf, Ei, Ef, dE, nm) {
    const inf = nf === Infinity, lo = Math.min(ni, inf ? Infinity : nf);
    TR.tr.textContent = `${ni} → ${inf ? '∞' : nf}`;
    TR.kind.textContent = inf ? 'ไอออไนเซชัน' : nf < ni ? 'ปล่อยโฟตอน' : 'ดูดกลืนโฟตอน';
    TR.dE.textContent = dE.toFixed(3) + ' eV';
    TR.lam.textContent = nm.toFixed(1) + ' nm';
    TR.f.textContent = sci(c0 / (nm * 1e-9), 3) + ' Hz';
    TR.ser.textContent = inf ? '— (ขีดจำกัดอนุกรม)' : (SERIES[lo] || '—');
    TR.reg.textContent = nm < 380 ? 'อัลตราไวโอเลต' : nm <= 750 ? 'แสงที่ตามองเห็น' : 'อินฟราเรด';
  }
  function addLine(nm, a, b) { if (!lines.find(l => l.a === a && l.b === b)) lines.push({ nm, a, b }); drawLines(); }
  function drawLines() {
    const vs = strip.querySelector('.vstrip'), ll = strip.querySelector('.linelist');
    vs.innerHTML = lines.filter(l => l.nm >= 380 && l.nm <= 750).map(l => { const c = rgbCss(wl2rgb(l.nm)); return `<i style="left:${(l.nm - 380) / 370 * 100}%;background:${c};color:${c}"></i>`; }).join('');
    ll.innerHTML = lines.length ? lines.slice().sort((p, q) => p.nm - q.nm).map(l => `<span class="mono">${l.a}→${l.b}: ${l.nm.toFixed(1)} nm</span>`).join('') : '<span>ยังไม่มีเส้น ลองให้อิเล็กตรอนลงระดับ</span>';
  }
  function showLevel() {
    if (st.ion) { LV.n.textContent = '∞ (ไอออน H⁺)'; LV.E.textContent = '0.00 eV'; LV.r.textContent = '—'; LV.v.textContent = '—'; LV.L.textContent = '—'; return; }
    const n = st.n;
    LV.n.textContent = String(n);
    LV.E.textContent = fx(En(n), 3) + ' eV';
    LV.r.textContent = (0.0529 * n * n).toFixed(4) + ' nm';
    LV.v.textContent = sci(2.19e6 / n, 3) + ' m/s';
    LV.L.textContent = n + 'ħ = ' + sci(n * 1.054571817e-34, 3) + ' J·s';
  }
  drawLines(); showLevel(); setBtns();
  TR.tr.textContent = '—'; ['kind', 'dE', 'lam', 'f', 'ser', 'reg'].forEach(k => TR[k].textContent = '—');

  let acc = 1;
  host.onUpdate(dt => {
    if (st.play) {
      for (let i = anims.length - 1; i >= 0; i--) if (anims[i](dt)) anims.splice(i, 1);
      const nEff = Math.sqrt(st.r / RS); st.phi += dt * 2.4 / Math.pow(nEff, 1.5);
      for (let i = photons.length - 1; i >= 0; i--) { updPhoton(photons[i], dt); if (photons[i].done) { killPhoton(photons[i]); photons.splice(i, 1); } }
    }
    const rr = st.ion ? st.r + st.out : st.r;
    elec.position.set(rr * Math.cos(st.phi), 0, rr * Math.sin(st.phi));
    acc += dt;
    if (acc > 0.08 && !st.ion) { acc = 0; const rn = 0.0529 * st.n * st.n; LV.xy.textContent = `(${fx(rn * Math.cos(st.phi), 4)}, ${fx(rn * Math.sin(st.phi), 4)}) nm`; }
    else if (st.ion) LV.xy.textContent = '—';
  });
  return { toggle() { st.play = !st.play; return st.play; } };
}
