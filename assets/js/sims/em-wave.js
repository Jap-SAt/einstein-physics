/* ─────────── Sim 2 : EM wave ─────────── */
function simEM(host, U) {
  const { world } = host;
  const c0 = 299792458, h = 6.62607015e-34, e = 1.602176634e-19, eps0 = 8.8541878188e-12;
  host.setHome(new THREE.Vector3(12, 10, 26), new THREE.Vector3(0, 0, 0));
  const st = { logL: Math.log10(532e-9), E0: 500, pol: 0, showE: true, showB: true, play: true, t: 0 };
  const X0 = -20, X1 = 20, NS = 321, STEP = 4, NST = (NS - 1) / STEP + 1, CV = 5;
  const xs = new Float32Array(NS); for (let i = 0; i < NS; i++) xs[i] = X0 + (X1 - X0) * i / (NS - 1);
  function mkField(color) {
    const sp = new Float32Array(NST * 6), sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const sm = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 }); const stems = new THREE.LineSegments(sg, sm); stems.frustumCulled = false;
    const cp = new Float32Array(NS * 3), cgeo = new THREE.BufferGeometry(); cgeo.setAttribute('position', new THREE.BufferAttribute(cp, 3));
    const cmat = new THREE.LineBasicMaterial({ color }); const curve = new THREE.Line(cgeo, cmat); curve.frustumCulled = false;
    const g = new THREE.Group(); g.add(stems, curve); return { g, sp, sg, sm, cp, cgeo, cmat };
  }
  const pol = new THREE.Group(); world.add(pol);
  const Ef = mkField(0xcf5f2a), Bf = mkField(0x3a6fd9); pol.add(Ef.g, Bf.g);
  const eL = makeLabel('E', '#cf5f2a', 1.6), bL = makeLabel('B', '#3a6fd9', 1.6); pol.add(eL, bL);
  const kA = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(X0, 0, 0), X1 - X0 + 3, 0x8a8e98, 1.2, 0.6); world.add(kA);
  const kL = makeLabel('ทิศการเคลื่อนที่', '#656973', 1.0); kL.position.set(X1 + 3, -1.2, 0); world.add(kL);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.MeshBasicMaterial({ color: inkHex(), transparent: true, opacity: 0.04, side: THREE.DoubleSide, depthWrite: false }));
  plane.rotation.y = Math.PI / 2; world.add(plane);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.03, 6, 80), new THREE.MeshBasicMaterial({ color: 0xb9b5ab })); ring.rotation.y = Math.PI / 2; world.add(ring);
  const probe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshBasicMaterial({ color: inkHex() })); world.add(probe);

  const BANDS = [[-12, -11, 'γ', '#d9d5f0'], [-11, -8, 'รังสีเอกซ์', '#e3dff5'], [-8, Math.log10(380e-9), 'UV', '#ece7fb'], [Math.log10(380e-9), Math.log10(750e-9), '', 'linear-gradient(90deg,#7a2ad6,#3a4cff,#16b5e6,#22c35e,#f0e02a,#ff8a1f,#e5252a)'], [Math.log10(750e-9), -3, 'อินฟราเรด', '#f7dfd6'], [-3, 0, 'ไมโครเวฟ', '#f4e9d4'], [0, 3, 'วิทยุ', '#e9eedb']];
  function band(L) { const lam = Math.pow(10, L); if (lam < 1e-11) return 'รังสีแกมมา'; if (lam < 1e-8) return 'รังสีเอกซ์'; if (lam < 380e-9) return 'อัลตราไวโอเลต'; if (lam <= 750e-9) return 'แสงที่ตามองเห็น'; if (lam < 1e-3) return 'อินฟราเรด'; if (lam < 1) return 'ไมโครเวฟ'; return 'คลื่นวิทยุ'; }

  let RO = null, LIVE = null, mk = null;
  function refresh() {
    const lam = Math.pow(10, st.logL), f = c0 / lam, nm = lam * 1e9, rgb = wl2rgb(nm);
    if (rgb) { Ef.cmat.color.setRGB(rgb[0], rgb[1], rgb[2]); Ef.sm.color.setRGB(rgb[0], rgb[1], rgb[2]); }
    else { Ef.cmat.color.setHex(0xcf5f2a); Ef.sm.color.setHex(0xcf5f2a); }
    const Ae = 1.2 + 3.3 * st.E0 / 1000; eL.position.set(X1 + 1, Ae + 0.6, 0); bL.position.set(X1 + 1, 0.6, Ae + 0.4);
    pol.rotation.x = st.pol * Math.PI / 180;
    Ef.g.visible = st.showE; eL.visible = st.showE; Bf.g.visible = st.showB; bL.visible = st.showB;
    if (mk) mk.style.left = ((st.logL + 12) / 15 * 100) + '%';
    if (!RO) return;
    RO.lam.textContent = si(lam, 'm');
    RO.f.textContent = si(f, 'Hz');
    RO.T.textContent = si(1 / f, 's');
    RO.Eph.textContent = sci(h * f / e, 3) + ' eV';
    RO.band.textContent = band(st.logL);
    RO.B0.textContent = sci(st.E0 / c0, 3) + ' T';
    RO.I.textContent = sci(0.5 * c0 * eps0 * st.E0 * st.E0, 3) + ' W/m²';
    const lv = 3 + (st.logL + 12) / 15 * 13, fv = CV / lv;
    RO.slow.textContent = '×' + sci(f / fv, 1);
  }
  U.head('คลื่นแม่เหล็กไฟฟ้าแบบสามมิติ', 'E (ส้ม/สีตามแสง) · B (น้ำเงิน) · คลื่นเคลื่อนที่ไปทาง +x');
  U.group('ความยาวคลื่น');
  const spec = U.html(`<div class="spec"><div class="spec-bar">${BANDS.map(b => `<div style="width:${(b[1] - b[0]) / 15 * 100}%;background:${b[3]}"></div>`).join('')}</div><div class="spec-mk"></div><div class="spec-lab">${BANDS.filter(b => b[2]).map(b => `<span style="left:${((b[0] + b[1]) / 2 + 12) / 15 * 100}%">${b[2]}</span>`).join('')}</div></div>`);
  mk = spec.querySelector('.spec-mk');
  const sL = U.slider({ label: 'λ (สเกลลอการิทึม)', min: -12, max: 3, step: 0.005, value: st.logL, fmt: x => si(Math.pow(10, x), 'm') }, x => { st.logL = x; refresh(); });
  const chips = U.html(`<div class="chips">${[['γ', 1e-12], ['X', 1e-10], ['UV', 2.5e-7], ['ม่วง', 410e-9], ['เขียว', 532e-9], ['แดง', 656e-9], ['IR', 1e-5], ['ไมโครเวฟ', 0.12], ['FM', 3]].map(([t, v]) => `<button data-v="${Math.log10(v)}">${t}</button>`).join('')}</div>`);
  chips.onclick = ev => { const b = ev.target.closest('button'); if (b) sL.setValue(parseFloat(b.dataset.v)); };
  U.group('แอมพลิจูดและโพลาไรเซชัน');
  U.slider({ label: 'แอมพลิจูดสนามไฟฟ้า E₀', min: 50, max: 1000, step: 10, value: 500, fmt: x => x + ' V/m' }, x => { st.E0 = x; refresh(); });
  U.slider({ label: 'มุมระนาบโพลาไรเซชัน', min: 0, max: 180, step: 1, value: 0, fmt: x => x + '°' }, x => { st.pol = x; refresh(); });
  U.check('แสดงสนามไฟฟ้า E', true, v => { st.showE = v; refresh(); });
  U.check('แสดงสนามแม่เหล็ก B', true, v => { st.showB = v; refresh(); });
  RO = U.readouts('ค่าของคลื่น', [['lam', 'ความยาวคลื่น λ'], ['f', 'ความถี่ f = c/λ'], ['T', 'คาบ T'], ['Eph', 'พลังงานโฟตอน hf'], ['band', 'ช่วงคลื่น'], ['B0', 'B₀ = E₀/c'], ['I', 'ความเข้ม ½cε₀E₀²'], ['slow', 'ภาพช้ากว่าจริง']]);
  LIVE = U.readouts('ที่ระนาบสังเกต x = 0', [['E', 'E(t)'], ['B', 'B(t)'], ['ratio', 'E / B']]);
  U.note('ในภาพขยายแอมพลิจูด B ให้เท่ากับ E เพื่อให้มองเห็น ค่าจริง B₀ เล็กกว่า E₀ ถึง c เท่า (ในหน่วย SI) ทุกความยาวคลื่นเคลื่อนที่ด้วยอัตราเร็วเท่ากันในภาพ เช่นเดียวกับในสุญญากาศ');
  refresh();

  let acc = 1;
  host.onUpdate(dt => {
    const lv = 3 + (st.logL + 12) / 15 * 13, kv = 2 * Math.PI / lv, wv = kv * CV;
    if (st.play) st.t += dt;
    const Ae = 1.2 + 3.3 * st.E0 / 1000;
    for (let i = 0; i < NS; i++) {
      const x = xs[i], s = Math.sin(kv * x - wv * st.t), a = Ae * s, j = i * 3;
      Ef.cp[j] = x; Ef.cp[j + 1] = a; Ef.cp[j + 2] = 0;
      Bf.cp[j] = x; Bf.cp[j + 1] = 0; Bf.cp[j + 2] = a;
      if (i % STEP === 0) {
        const q = (i / STEP) * 6;
        Ef.sp[q] = x; Ef.sp[q + 1] = 0; Ef.sp[q + 2] = 0; Ef.sp[q + 3] = x; Ef.sp[q + 4] = a; Ef.sp[q + 5] = 0;
        Bf.sp[q] = x; Bf.sp[q + 1] = 0; Bf.sp[q + 2] = 0; Bf.sp[q + 3] = x; Bf.sp[q + 4] = 0; Bf.sp[q + 5] = a;
      }
    }
    Ef.cgeo.attributes.position.needsUpdate = true; Ef.sg.attributes.position.needsUpdate = true;
    Bf.cgeo.attributes.position.needsUpdate = true; Bf.sg.attributes.position.needsUpdate = true;
    acc += dt;
    if (acc > 0.07) {
      acc = 0; const s0 = Math.sin(-wv * st.t), Ev = st.E0 * s0, Bv = Ev / c0;
      LIVE.E.textContent = fx(Ev, 1) + ' V/m';
      LIVE.B.textContent = (Bv < 0 ? '−' : ' ') + sci(Math.abs(Bv) || 0, 3) + ' T';
      LIVE.ratio.textContent = Math.abs(Ev) > 1 ? sci(Ev / Bv, 4) + ' m/s' : '— (ทั้งคู่ ≈ 0)';
    }
  });
  return { toggle() { st.play = !st.play; return st.play; } };
}
