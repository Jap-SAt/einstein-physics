/* ════════════════ cosmos: กำเนิดจักรวาล ════════════════
   Full-screen dark-mode journey from the Big Bang to life, told in 9 stages.
   One particle system (N points) morphs between stage layouts; each stage adds a few objects.
   Palette and pacing: deep black, warm amber/gold light, slow drifting camera.
   Facts checked against Planck 2018 (age 13.787 ± 0.020 Gyr), Big Bang nucleosynthesis
   (~75% H / 25% He by mass), recombination ≈ 380,000 yr, Earth 4.54 Gyr, earliest life ≥ 3.5 Gyr. */
const Cosmos = (() => {
  const YR = 3.156e7;
  const STAGES = [
    { title: 'จุดเริ่มต้น', era: '13,800 ล้านปีก่อน · t = 0', a0: 0, a1: 1e-43, dur: 6, blend: 1.5,
      cam: { r: 22, el: 12 }, bg: [0, 0, 0],
      txt: 'ทุกสิ่งในเอกภพที่สังเกตได้ เริ่มจากสภาวะที่ร้อนและหนาแน่นอย่างยิ่ง ฟิสิกส์ที่เรารู้จักยังอธิบายช่วงก่อน 10⁻⁴³ วินาทีไม่ได้',
      fact: '<b>ผู้เชี่ยวชาญตรวจทาน:</b> บิกแบงไม่ใช่การระเบิดจากจุดหนึ่งในอวกาศ แต่เป็นการขยายตัวของอวกาศเองทุกแห่งพร้อมกัน ภาพจุดสว่างนี้เป็นเพียงการเปรียบเทียบ' },
    { title: 'การพองตัว', era: 'Inflation · 10⁻³⁶ – 10⁻³² วินาที', a0: 1e-36, a1: 1e-32, dur: 6, blend: 0.6,
      cam: { r: 46, el: 14 }, bg: [0.05, 0.025, 0.008],
      txt: 'อวกาศขยายตัวแบบเอกซ์โพเนนเชียล ขนาดเพิ่มขึ้นอย่างน้อย 10²⁶ เท่าในเสี้ยววินาที ความไม่สม่ำเสมอระดับควอนตัมถูกยืดจนกลายเป็นเมล็ดพันธุ์ของกาแล็กซี',
      fact: '<b>หลักฐาน:</b> รูปแบบอุณหภูมิของรังสีไมโครเวฟพื้นหลังที่ดาวเทียม Planck วัดได้ สอดคล้องกับทฤษฎีการพองตัว' },
    { title: 'ซุปควาร์ก–กลูออน', era: '10⁻¹² – 10⁻⁶ วินาที', a0: 1e-12, a1: 1e-6, dur: 7, blend: 2.2,
      cam: { r: 58, el: 18 }, bg: [0.08, 0.035, 0.012],
      txt: 'เอกภพร้อนเกินกว่าที่ควาร์กจะจับกลุ่มกัน ควาร์กและกลูออนจึงเคลื่อนที่อิสระ เมื่อเย็นลงถึงราว 1 ไมโครวินาที ควาร์กรวมกันเป็นโปรตอนและนิวตรอน',
      fact: '<b>หมายเหตุ:</b> สีแดง เขียว น้ำเงิน แทน “ประจุสี” ของควาร์กในแรงอย่างเข้ม ไม่ใช่สีที่ตามองเห็น' },
    { title: 'นิวเคลียสแรก', era: '10 วินาที – 20 นาที', a0: 10, a1: 1200, dur: 8, blend: 2.6,
      cam: { r: 50, el: 20 }, bg: [0.06, 0.03, 0.012],
      txt: 'โปรตอน (แดง) และนิวตรอน (เทา) หลอมรวมเป็นนิวเคลียสฮีเลียม เมื่อเอกภพขยายตัวจนเย็นลง ปฏิกิริยานิวเคลียร์ก็หยุด จุดสีน้ำเงินจาง ๆ คืออิเล็กตรอนอิสระ',
      fact: '<b>ผลลัพธ์:</b> ไฮโดรเจนราว 75% และฮีเลียมราว 25% โดยมวล ตรงกับองค์ประกอบของดาวฤกษ์ที่เก่าแก่ที่สุด (ย้อนดูบทฟิสิกส์นิวเคลียร์: ฟิวชัน)' },
    { title: 'อะตอมแรกและแสงแรก', era: '≈ 380,000 ปี', a0: 5e4 * YR, a1: 3.8e5 * YR, dur: 9, blend: 2.6,
      cam: { r: 82, el: 16 }, bg: [0, 0, 0],
      txt: 'เอกภพเย็นลงเหลือราว 3,000 K อิเล็กตรอนถูกนิวเคลียสจับไว้เป็นอะตอม โฟตอนจึงไม่ถูกกระเจิงอีกและพุ่งออกไปอย่างอิสระ เอกภพโปร่งแสงเป็นครั้งแรก',
      fact: '<b>เชื่อมกับบทเรียน:</b> แสงนั้นยังมาถึงเราวันนี้ ถูกยืดจนเป็นคลื่นไมโครเวฟอุณหภูมิ 2.7 K เรียกว่ารังสีไมโครเวฟพื้นหลังของจักรวาล (CMB)' },
    { title: 'ยุคมืดสู่ดาวฤกษ์ดวงแรก', era: '≈ 100 – 400 ล้านปี', a0: 1e8 * YR, a1: 4e8 * YR, dur: 9, blend: 3.5,
      cam: { r: 86, el: 26 }, bg: [0.004, 0.004, 0.009],
      txt: 'แรงโน้มถ่วงดึงแก๊สในบริเวณที่หนาแน่นกว่าเล็กน้อยให้ยุบตัว แกนกลางร้อนขึ้นจนเกิดฟิวชัน ดาวฤกษ์ดวงแรกจึงจุดแสงขึ้นในความมืด',
      fact: '<b>ธาตุหนัก:</b> คาร์บอน ออกซิเจน และเหล็ก เกิดจากฟิวชันในดาวฤกษ์ แล้วถูกกระจายออกไปด้วยซูเปอร์โนวา' },
    { title: 'กาแล็กซี', era: '≈ 400 ล้าน – หลายพันล้านปี', a0: 4e8 * YR, a1: 5e9 * YR, dur: 10, blend: 3.5,
      cam: { r: 78, el: 42 }, bg: [0.003, 0.003, 0.008],
      txt: 'ดาวฤกษ์และแก๊สรวมตัวเป็นกาแล็กซี การหมุนทำให้แผ่ออกเป็นจานและเกิดแขนกังหัน ทางช้างเผือกของเราก็เริ่มก่อตัวในยุคนี้',
      fact: '<b>เชื่อมกับบทเรียน:</b> ดาวโคจรรอบใจกลางกาแล็กซีด้วยหลักเดียวกับวงโคจรในบทกลศาสตร์ แรงโน้มถ่วงทำหน้าที่เป็นแรงสู่ศูนย์กลาง' },
    { title: 'ระบบสุริยะ', era: '4,600 ล้านปีก่อน', a0: 9.15e9 * YR, a1: 9.25e9 * YR, dur: 10, blend: 3.5,
      cam: { r: 58, el: 17 }, bg: [0.004, 0.003, 0.002],
      txt: 'เมฆแก๊สและฝุ่นที่มีธาตุหนักจากดาวรุ่นก่อนยุบตัวและหมุนเป็นจาน ใจกลางกลายเป็นดวงอาทิตย์ เศษในจานชนและรวมกันเป็นดาวเคราะห์',
      fact: '<b>ผู้เชี่ยวชาญตรวจทาน:</b> จานหมุนเร็วขึ้นเมื่อยุบตัว เพราะโมเมนตัมเชิงมุมอนุรักษ์ เหมือนนักสเก็ตที่หุบแขนแล้วหมุนเร็วขึ้น' },
    { title: 'โลกและสิ่งมีชีวิต', era: '4,540 ล้านปีก่อน → ปัจจุบัน', a0: 9.25e9 * YR, a1: 13.8e9 * YR, dur: 14, blend: 3.5,
      cam: { r: 44, el: 10, tx: 11 }, bg: [0.002, 0.002, 0.005],
      txt: 'โลกก่อตัวเมื่อ 4,540 ล้านปีก่อน และหลักฐานของสิ่งมีชีวิตมีอายุอย่างน้อย 3,500 ล้านปี DNA ในเซลล์ของเราประกอบจากอะตอมที่เกิดในบิกแบงและในดาวฤกษ์',
      fact: '<b>ฝุ่นดาว:</b> ไฮโดรเจนในร่างกายเราเกิดในไม่กี่นาทีแรกของเอกภพ ส่วนคาร์บอนและออกซิเจนมาจากดาวฤกษ์ เราจึงสร้างขึ้นจากฝุ่นดาวจริง ๆ' }
  ];

  let S = null;

  /* ── helpers ── */
  function glowTex(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,.35)') {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, inner); gr.addColorStop(0.25, mid); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); return t;
  }
  function earthTex() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
    const sea = g.createLinearGradient(0, 0, 0, 256); sea.addColorStop(0, '#0d2f5c'); sea.addColorStop(0.5, '#1b5a9a'); sea.addColorStop(1, '#0d2f5c');
    g.fillStyle = sea; g.fillRect(0, 0, 512, 256);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 14; k++) {                       // continents as clusters of blobs
      const cx = rnd() * 512, cy = 50 + rnd() * 156, n = 18 + rnd() * 30;
      for (let j = 0; j < n; j++) {
        const x = cx + (rnd() - 0.5) * 90, y = cy + (rnd() - 0.5) * 50, r = 6 + rnd() * 16;
        g.fillStyle = rnd() < 0.7 ? '#2f6b3a' : '#7a6a45'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        g.beginPath(); g.arc((x + 512) % 512, y, r, 0, 7); g.fill();
      }
    }
    g.fillStyle = '#e9f0f5'; g.fillRect(0, 0, 512, 14); g.fillRect(0, 242, 512, 14);
    g.globalAlpha = 0.35; g.fillStyle = '#ffffff';
    for (let j = 0; j < 160; j++) { g.beginPath(); g.ellipse(rnd() * 512, 20 + rnd() * 216, 8 + rnd() * 26, 3 + rnd() * 5, 0, 0, 7); g.fill(); }
    return new THREE.CanvasTexture(c);
  }
  const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
  function fmtAge(sec) {
    if (sec <= 1e-43) return '≈ 0 วินาที';
    if (sec < 1e-3) return sci(sec, 1) + ' วินาที';
    if (sec < 60) return sec.toFixed(1) + ' วินาที';
    if (sec < 3600) return (sec / 60).toFixed(1) + ' นาที';
    const y = sec / YR;
    if (y < 1e6) return Math.round(y).toLocaleString('en-US') + ' ปี';
    return Math.round(y / 1e6).toLocaleString('en-US') + ' ล้านปี';
  }

  /* ── open / close ── */
  function open() {
    if (S) return;
    const el = document.createElement('div'); el.className = 'cosmos'; el.id = 'cosmos';
    el.innerHTML = `
      <div class="cz-stage"></div><div class="cz-flash"></div>
      <div class="cz-top"><div class="cz-brand">กำเนิดจักรวาล <span>· จากบิกแบงสู่สิ่งมีชีวิต</span></div><button class="cz-btn" data-a="close">ปิด ✕</button></div>
      <div class="cz-hint">ลากเพื่อหมุน · เลื่อนเพื่อซูม · ← → เปลี่ยนฉาก · Esc ปิด</div>
      <div class="cz-cap"><div class="cz-step mono"></div><div class="cz-time mono"></div><h2 class="cz-title"></h2><p class="cz-txt"></p><div class="cz-fact"></div>
        <div class="cz-end"><button class="cz-btn" data-a="replay">↺ เล่นอีกครั้ง</button><button class="cz-btn" data-a="close">กลับสู่บทเรียน</button></div></div>
      <div class="cz-bar"><div class="cz-ticks">${STAGES.map((s, i) => `<button data-i="${i}" title="${s.title}"><span>${s.title}</span><i><b></b></i></button>`).join('')}</div>
        <div class="cz-ctrl"><button data-a="prev" title="ฉากก่อนหน้า">‹</button><button data-a="play" title="หยุด/เล่น">❚❚</button><button data-a="next" title="ฉากถัดไป">›</button></div>
        <div class="cz-clock mono"><small>เวลาหลังบิกแบง</small><span></span></div></div>`;
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    S = { el };
    Theme.set('dark');                       // the site switches to dark mode with the journey
    try { build(); } catch (e) { console.error(e); close(); return; }
    requestAnimationFrame(() => el.classList.add('on'));
    el.addEventListener('click', onUI);
    window.addEventListener('keydown', onKey);
    flash(1);
    goto(0);
  }
  function close() {
    if (!S) return;
    const s = S; S = null;
    cancelAnimationFrame(s.raf);
    window.removeEventListener('keydown', onKey);
    if (s.ro) s.ro.disconnect();
    if (s.controls) s.controls.dispose();
    if (s.scene) s.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    if (s.renderer) { s.renderer.dispose(); }
    s.el.classList.remove('on');
    setTimeout(() => s.el.remove(), 700);
    document.body.style.overflow = '';
    route(true);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') goto(S.k + 1);
    else if (e.key === 'ArrowLeft') goto(S.k - 1);
    else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  }
  function onUI(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.i != null) return goto(+b.dataset.i);
    const a = b.dataset.a;
    if (a === 'close') close();
    else if (a === 'next') goto(S.k + 1);
    else if (a === 'prev') goto(S.k - 1);
    else if (a === 'play') togglePlay();
    else if (a === 'replay') { S.done = false; goto(0); flash(1); }
  }
  function togglePlay() { S.play = !S.play; S.el.querySelector('[data-a="play"]').textContent = S.play ? '❚❚' : '▶'; }
  function flash(v) { const f = S.el.querySelector('.cz-flash'); f.style.opacity = v; setTimeout(() => { if (f) f.style.opacity = 0; }, 350); }

  /* ── scene ── */
  function build() {
    const stage = S.el.querySelector('.cz-stage');
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 1);
    stage.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 3000);
    camera.position.set(0, 4, 22);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.06; controls.autoRotate = true; controls.autoRotateSpeed = 0.35;
    controls.minDistance = 3; controls.maxDistance = 600; controls.enablePan = false;
    controls.addEventListener('start', () => { if (S) S.userCam = true; });
    scene.add(new THREE.AmbientLight(0xffffff, 0.12));
    const sunLight = new THREE.PointLight(0xffd8a0, 0, 400); scene.add(sunLight);
    const keyLight = new THREE.DirectionalLight(0xfff1dc, 0); keyLight.position.set(-30, 12, 20); scene.add(keyLight);

    const N = 9000;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pTex = glowTex('rgba(255,255,255,1)', 'rgba(255,255,255,.45)');
    const pMat = new THREE.PointsMaterial({ size: 0.42, map: pTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    const points = new THREE.Points(geo, pMat); points.frustumCulled = false; scene.add(points);

    /* per-particle random constants */
    let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const gauss = () => { let u = 0, v = 0; while (u === 0) u = rnd(); v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v); };
    const dir = new Float32Array(N * 3), rr = new Float32Array(N), r1 = new Float32Array(N), r2 = new Float32Array(N), r3 = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let x = gauss(), y = gauss(), z = gauss(); const l = Math.hypot(x, y, z) || 1;
      dir[i * 3] = x / l; dir[i * 3 + 1] = y / l; dir[i * 3 + 2] = z / l;
      rr[i] = Math.cbrt(rnd()); r1[i] = rnd(); r2[i] = rnd(); r3[i] = rnd();
    }
    /* nucleosynthesis bookkeeping: 240 He (2p+2n), 2760 H (p), electrons, leftover photons
       → 2760 : 240 ≈ 12 : 1 by number ≈ 25% helium by mass */
    const K = 3000, HE = 240, cen = new Float32Array(K * 3);
    for (let k = 0; k < K; k++) { const d = Math.cbrt(rnd()) * 30; let x = gauss(), y = gauss(), z = gauss(); const l = Math.hypot(x, y, z) || 1; cen[k * 3] = x / l * d; cen[k * 3 + 1] = y / l * d; cen[k * 3 + 2] = z / l * d; }
    const role = new Uint8Array(N), nuc = new Int32Array(N).fill(-1), slot = new Uint8Array(N);
    // role: 0 proton, 1 neutron, 3 bound electron, 4 photon
    for (let i = 0; i < N; i++) {
      if (i < HE * 4) { nuc[i] = i >> 2; slot[i] = i & 3; role[i] = (i & 3) < 2 ? 0 : 1; }
      else if (i < HE * 4 + (K - HE)) { nuc[i] = HE + (i - HE * 4); role[i] = 0; }
      else { const j = i - (HE * 4 + K - HE); if (j < HE * 2) { role[i] = 3; nuc[i] = j >> 1; slot[i] = j & 1; } else if (j < HE * 2 + (K - HE)) { role[i] = 3; nuc[i] = HE + (j - HE * 2); } else role[i] = 4; }
    }
    const HEOFF = [[0.32, 0.32, 0.32], [-0.32, -0.32, 0.32], [-0.32, 0.32, -0.32], [0.32, -0.32, -0.32]];
    const G = 34, clump = new Float32Array(G * 3);
    for (let g = 0; g < G; g++) { const d = 12 + rnd() * 30, a = rnd() * 6.283, y = (rnd() - 0.5) * 30; clump[g * 3] = Math.cos(a) * d; clump[g * 3 + 1] = y; clump[g * 3 + 2] = Math.sin(a) * d; }

    /* extra objects */
    const flareMat = new THREE.SpriteMaterial({ map: glowTex('rgba(255,250,235,1)', 'rgba(255,205,130,.5)'), color: 0xffe6b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const flare = new THREE.Sprite(flareMat); flare.scale.setScalar(6); scene.add(flare);
    const starTex = glowTex('rgba(255,255,255,1)', 'rgba(170,200,255,.5)');
    const stars = [];
    for (let g = 0; g < G; g++) {
      const m = new THREE.SpriteMaterial({ map: starTex, color: 0xbcd2ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
      const s = new THREE.Sprite(m); s.position.set(clump[g * 3], clump[g * 3 + 1], clump[g * 3 + 2]); s.scale.setScalar(4.5); scene.add(s); stars.push(s);
    }
    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(255,248,225,1)', 'rgba(255,190,90,.55)'), color: 0xffd28a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    sunGlow.scale.setScalar(16); scene.add(sunGlow);
    const sunCore = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 20), new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0 })); scene.add(sunCore);
    const planets = [[6.5, 0.32, 0xb7a58f], [9.5, 0.55, 0xe2c08a], [13, 0.6, 0x3f7fd0], [18, 0.42, 0xc96a44], [26, 1.4, 0xd9b48a]].map(([r, s, c], k) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(s, 24, 16), new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, transparent: true, opacity: 0 }));
      m.userData = { r, ph: k * 1.7 }; scene.add(m); return m;
    });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(5.5, 64, 40), new THREE.MeshStandardMaterial({ map: earthTex(), roughness: 0.85, transparent: true, opacity: 0 }));
    earth.rotation.z = 0.41; earth.position.x = 4; scene.add(earth);   // 23.4° axial tilt
    const atmo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(120,180,255,0)', 'rgba(110,170,255,.35)'), color: 0x8fc2ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    atmo.scale.setScalar(15); atmo.position.x = 4; scene.add(atmo);

    Object.assign(S, {
      renderer, scene, camera, controls, sunLight, keyLight, N, pos, col, geo, pMat,
      dir, rr, r1, r2, r3, cen, role, nuc, slot, HEOFF, G, clump,
      flare, stars, sunGlow, sunCore, planets, earth, atmo,
      tp: new Float32Array(N * 3), tc: new Float32Array(N * 3), sp: new Float32Array(N * 3), sc: new Float32Array(N * 3),
      k: 0, t: 0, play: true, userCam: false, bg: new THREE.Color(0, 0, 0), tgt: new THREE.Vector3(), done: false
    });
    // all particles start at the centre
    for (let i = 0; i < N * 3; i++) pos[i] = dir[i] * 0.05;
    function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    S.ro = new ResizeObserver(resize); S.ro.observe(stage); resize();
    let last = performance.now();
    const loop = now => { if (!S) return; S.raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; frame(dt); };
    S.raf = requestAnimationFrame(loop);
  }

  /* ── stage control ── */
  function goto(k) {
    if (!S) return;
    k = Math.max(0, Math.min(STAGES.length - 1, k));
    S.k = k; S.t = 0; S.userCam = false;
    S.sp.set(S.pos); S.sc.set(S.col);       // snapshot for blending
    const st = STAGES[k], cap = S.el.querySelector('.cz-cap');
    cap.classList.add('fade');
    setTimeout(() => {
      if (!S) return;
      cap.querySelector('.cz-step').textContent = `${String(k + 1).padStart(2, '0')} / ${String(STAGES.length).padStart(2, '0')}`;
      cap.querySelector('.cz-time').textContent = st.era;
      cap.querySelector('.cz-title').textContent = st.title;
      cap.querySelector('.cz-txt').textContent = st.txt;
      cap.querySelector('.cz-fact').innerHTML = st.fact;
      cap.querySelector('.cz-end').classList.toggle('on', k === STAGES.length - 1);
      cap.classList.remove('fade');
    }, 450);
    if (k === 1) flash(0.9);
  }

  /* ── per-stage particle layouts: write target positions (tp) and colours (tc) ── */
  function layout(k, t) {
    const { N, tp, tc, dir, rr, r1, r2, r3, cen, role, nuc, slot, HEOFF, G, clump } = S;
    const set = (i, x, y, z, r, g, b) => { const j = i * 3; tp[j] = x; tp[j + 1] = y; tp[j + 2] = z; tc[j] = r; tc[j + 1] = g; tc[j + 2] = b; };
    const nucPos = (i, out) => {                       // position of particle i's nucleus centre
      const c = nuc[i] * 3; out[0] = cen[c]; out[1] = cen[c + 1]; out[2] = cen[c + 2];
    };
    const clumpPos = (i, out) => {                     // collapsed position inside a gas clump
      const n = nuc[i] >= 0 ? nuc[i] : i, g = n % G, q = (n % N) * 3, s = 2.6 * rr[n % N] * (1 + 0.08 * Math.sin(t * 1.5 + n));
      out[0] = clump[g * 3] + dir[q] * s; out[1] = clump[g * 3 + 1] + dir[q + 1] * s; out[2] = clump[g * 3 + 2] + dir[q + 2] * s;
    };
    const P = [0, 0, 0];
    for (let i = 0; i < N; i++) {
      const j = i * 3, dx = dir[j], dy = dir[j + 1], dz = dir[j + 2];
      if (k === 0) {
        const s = rr[i] * 0.3 * (1 + 0.2 * Math.sin(t * 3 + r1[i] * 6));
        set(i, dx * s, dy * s, dz * s, 1, 0.93, 0.76);
      } else if (k === 1) {
        const R = 0.3 + 40 * (1 - Math.exp(-t * 1.1)), s = rr[i] * R;
        set(i, dx * s, dy * s, dz * s, 0.95, 0.85 - 0.3 * rr[i], 0.7 - 0.5 * rr[i]);
      } else if (k === 2) {
        const s = rr[i] * 42, q = i % 3, w = 0.9;
        const c = q === 0 ? [1, 0.3, 0.22] : q === 1 ? [0.3, 1, 0.42] : [0.32, 0.5, 1];
        set(i, dx * s + Math.sin(t * 6 + r1[i] * 40) * w, dy * s + Math.sin(t * 7 + r2[i] * 40) * w, dz * s + Math.sin(t * 5 + r3[i] * 40) * w,
          (c[0] * 0.55 + 0.45) * 0.62, (c[1] * 0.55 + 0.28) * 0.62, (c[2] * 0.55 + 0.14) * 0.62);
      } else if (k === 3 || k === 4) {
        const rl = role[i];
        if (rl <= 1) {
          nucPos(i, P); let ox = 0, oy = 0, oz = 0;
          if (nuc[i] < 240) { const o = HEOFF[slot[i]]; ox = o[0]; oy = o[1]; oz = o[2]; }
          if (k === 3) set(i, P[0] + ox, P[1] + oy, P[2] + oz, rl === 0 ? 0.95 : 0.6, rl === 0 ? 0.36 : 0.62, rl === 0 ? 0.22 : 0.7);
          else set(i, P[0] + ox, P[1] + oy, P[2] + oz, 0.75, 0.62, 0.42);
        } else if (rl === 3 && k === 4) {
          nucPos(i, P); const a = t * 3 + r1[i] * 6.283 + slot[i] * Math.PI, R = nuc[i] < 240 ? 1.15 : 0.85;
          set(i, P[0] + Math.cos(a) * R, P[1] + Math.sin(a) * R * 0.5, P[2] + Math.sin(a) * R, 0.3, 0.42, 0.75);
        } else if (rl === 4 && k === 4) {             // decoupled photons stream away: the CMB
          const s = rr[i] * 40 + t * 16, f = Math.max(0, 1 - t / 8.5);
          set(i, dx * s, dy * s, dz * s, 0.95 * f, 0.42 * f, 0.16 * f);
        } else {                                       // free electrons in the plasma
          const s = rr[i] * 40;
          set(i, dx * s + Math.sin(t * 9 + r1[i] * 50) * 1.4, dy * s + Math.sin(t * 8 + r2[i] * 50) * 1.4, dz * s + Math.sin(t * 10 + r3[i] * 50) * 1.4, 0.22, 0.32, 0.65);
        }
      } else if (k === 5) {
        if (role[i] === 4) { const s = 180 + rr[i] * 40; set(i, dx * s, dy * s, dz * s, 0, 0, 0); continue; }
        clumpPos(i, P);
        if (role[i] === 3) { const a = t * 3 + r1[i] * 6.283; P[0] += Math.cos(a) * 0.5; P[2] += Math.sin(a) * 0.5; }
        set(i, P[0], P[1], P[2], 0.5, 0.56, 0.78);
      } else if (k === 6) {
        if (i % 7 === 0) {                              // central bulge
          const s = rr[i] * 5; set(i, dx * s, dy * s * 0.6, dz * s, 1, 0.76, 0.44); continue;
        }
        const r = 1.5 + 38 * Math.pow(r1[i], 0.9), arm = i % 2;
        const ang = arm * Math.PI + 2.3 * Math.log(r) + (r2[i] - 0.5) * 0.85 - t * 2.2 / Math.sqrt(r);
        const y = (r3[i] - 0.5) * 3 * Math.exp(-r / 14);
        const hii = (i % 29 === 0), core = r < 6;
        set(i, Math.cos(ang) * r, y, Math.sin(ang) * r,
          hii ? 1 : core ? 1 : 0.55, hii ? 0.42 : core ? 0.74 : 0.66, hii ? 0.62 : core ? 0.44 : 0.95);
      } else if (k === 7) {
        const r = 3.4 + 32 * Math.pow(r1[i], 1.25), w = 7 / Math.pow(r, 1.5);   // Kepler: ω ∝ r^(-3/2)
        const ang = r2[i] * 6.283 + w * t, y = (r3[i] - 0.5) * 0.22 * Math.sqrt(r);
        const f = Math.min(1, (r - 3.4) / 30);
        set(i, Math.cos(ang) * r, y, Math.sin(ang) * r, 1 - 0.1 * f, 0.88 - 0.5 * f, 0.62 - 0.55 * f);
      } else {
        const NB = Math.floor(N * 0.55);
        if (i < NB) { const s = 140 + rr[i] * 80, b = 0.18 + 0.4 * r1[i]; set(i, dx * s, dy * s, dz * s, b * 0.95, b * 0.95, b); continue; }
        const m = i - NB, M = N - NB, s = m / M, kind = m % 3, x0 = 19, turns = 3.5, R = 2.6;
        const th = s * 6.283 * turns + t * 0.6;
        if (kind < 2) {
          const a = th + kind * Math.PI;
          set(i, x0 + Math.cos(a) * R, -14 + 28 * s, Math.sin(a) * R, kind ? 0.32 : 0.28, kind ? 0.6 : 0.9, kind ? 0.95 : 0.66);
        } else {                                        // base pairs between the two strands
          const sq = Math.floor(s * 46) / 46, a = sq * 6.283 * turns + t * 0.6, u = r1[i] * 2 - 1;
          set(i, x0 + Math.cos(a) * R * u, -14 + 28 * sq, Math.sin(a) * R * u, 0.85, 0.66, 0.36);
        }
      }
    }
  }

  /* ── per frame ── */
  function frame(dt) {
    const st = STAGES[S.k];
    if (S.play) {
      S.t += dt;
      if (S.t > st.dur && S.k < STAGES.length - 1) goto(S.k + 1);
    }
    const t = S.t, k = S.k;
    layout(k, t);
    const b = ease(t / st.blend), { pos, col, sp, sc, tp, tc } = S, n3 = S.N * 3;
    for (let i = 0; i < n3; i++) { pos[i] = sp[i] + (tp[i] - sp[i]) * b; col[i] = sc[i] + (tc[i] - sc[i]) * b; }
    S.geo.attributes.position.needsUpdate = true; S.geo.attributes.color.needsUpdate = true;

    // background tint
    const bgT = new THREE.Color(st.bg[0], st.bg[1], st.bg[2]);
    S.bg.lerp(bgT, Math.min(1, dt * (k === 4 ? 0.6 : 1.2))); S.renderer.setClearColor(S.bg, 1);

    // stage objects
    const fade = (obj, target, rate = 1.5) => { obj.material.opacity += (target - obj.material.opacity) * Math.min(1, dt * rate); };
    S.flare.material.opacity = k === 0 ? Math.min(1, t / 2) * (0.75 + 0.25 * Math.sin(t * 5)) : k === 1 ? Math.max(0, 1 - t / 1.4) : 0;
    S.flare.scale.setScalar(k === 0 ? 4 + t * 1.2 : k === 1 ? 11 + t * 60 : 4);
    S.stars.forEach((s, g) => {
      const on = k === 5 ? Math.min(1, Math.max(0, (t - 3 - g * 0.09) / 1.2)) : 0;
      fade(s, on * (0.8 + 0.2 * Math.sin(t * 3 + g)), k === 5 ? 3 : 1.2);
      s.scale.setScalar(3.5 + 2 * on);
    });
    fade(S.sunGlow, k === 7 ? Math.min(1, t / 3) : 0); fade(S.sunCore, k === 7 ? Math.min(1, t / 3) : 0);
    S.sunGlow.scale.setScalar(14 + Math.sin(t * 2) * 0.6);
    S.sunLight.intensity += ((k === 7 ? 2.2 : 0) - S.sunLight.intensity) * Math.min(1, dt * 2);
    S.planets.forEach((p, q) => {
      const grow = k === 7 ? Math.min(1, Math.max(0, (t - 3 - q * 0.6) / 2.5)) : 0;
      fade(p, grow, 2); p.scale.setScalar(0.2 + 0.8 * grow);
      const w = 7 / Math.pow(p.userData.r, 1.5); p.position.set(Math.cos(p.userData.ph + w * t) * p.userData.r, 0, Math.sin(p.userData.ph + w * t) * p.userData.r);
    });
    fade(S.earth, k === 8 ? Math.min(1, t / 3) : 0); fade(S.atmo, k === 8 ? Math.min(0.85, t / 3) : 0);
    S.earth.rotation.y += dt * 0.12;
    S.keyLight.intensity += ((k === 8 ? 1.3 : 0) - S.keyLight.intensity) * Math.min(1, dt * 2);

    // camera: drift toward the stage framing unless the viewer took control
    const c = st.cam; S.tgt.lerp(new THREE.Vector3(c.tx || 0, 0, 0), Math.min(1, dt * 0.8));
    S.controls.target.copy(S.tgt);
    if (!S.userCam) {
      const off = S.camera.position.clone().sub(S.tgt), sph = new THREE.Spherical().setFromVector3(off);
      sph.radius += (c.r - sph.radius) * Math.min(1, dt * 0.7);
      sph.phi += ((Math.PI / 2 - c.el * Math.PI / 180) - sph.phi) * Math.min(1, dt * 0.7);
      S.camera.position.copy(S.tgt).add(new THREE.Vector3().setFromSpherical(sph));
    }
    S.controls.update();
    // keep particles legible when the camera pulls back for the large-scale stages
    const dist = S.camera.position.distanceTo(S.tgt);
    S.pMat.size = (k >= 4 && k <= 6) ? Math.min(1.2, 0.34 + dist * 0.009) : 0.42;
    S.renderer.render(S.scene, S.camera);

    // timeline + clock
    const ticks = S.el.querySelectorAll('.cz-ticks b');
    ticks.forEach((bb, i) => bb.style.width = (i < k ? 100 : i > k ? 0 : Math.min(100, 100 * t / st.dur)) + '%');
    const u = Math.min(1, t / st.dur);
    const age = st.a0 > 0 ? st.a0 * Math.pow(st.a1 / st.a0, u) : st.a1 * u;
    S.el.querySelector('.cz-clock span').textContent = fmtAge(age);
  }

  return { open, close, isOpen: () => !!S };
})();
