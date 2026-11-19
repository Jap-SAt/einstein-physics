/* ════════════════ cosmos: กำเนิดจักรวาล ════════════════
   Full-screen, dark-mode journey from the Big Bang to life, told in 9 stages.

   How it works
   • One particle system (PARTICLES points) morphs between per-stage layouts. Each frame the current
     stage writes target positions/colours (LAYOUTS[stage.id]); the points blend from a snapshot taken
     when the stage began toward those targets.
   • A few extra objects (flare, first stars, Sun, planets, Earth) fade in only in their own stage.
   • Palette and pacing follow a cinematic look: deep black, warm amber/gold light, slow drifting camera.

   Facts checked against Planck 2018 (age 13.787 ± 0.020 Gyr), Big Bang nucleosynthesis
   (~75% H / 25% He by mass ≈ 12 H : 1 He by number), recombination ≈ 380,000 yr,
   Earth 4.54 Gyr, earliest undisputed life ≥ 3.5 Gyr.

   Public API (unchanged): Cosmos.open([{ onClose }]), Cosmos.close(), Cosmos.isOpen()
   Depends on globals from helpers.js: THREE, THREE.OrbitControls, Theme, sci; and route() from app.js. */
const Cosmos = (() => {
  'use strict';

  /* ── constants ── */
  const TAU = Math.PI * 2;
  const YEAR = 3.156e7;                       // seconds in a year
  const PARTICLES = 9000;
  const NUCLEI = 3000;                        // nucleus centres used from the "nuclei" stage on
  const HELIUM = 240;                         // centres [0, 240) are ⁴He (2p + 2n); the rest are ¹H
  const CLUMPS = 34;                          // gas clumps that collapse into the first stars
  const NUCLEUS_RADIUS = 30;                  // spread of nucleus centres (scene units)
  // Particle roles. LEFTOVER particles have no nucleus: they are drawn as free plasma particles and,
  // after recombination, as the decoupled CMB photons (a visual stand-in, not a physical conversion).
  const ROLE = { PROTON: 0, NEUTRON: 1, ELECTRON: 2, LEFTOVER: 3 };
  const HE_OFFSETS = [[0.32, 0.32, 0.32], [-0.32, -0.32, 0.32], [-0.32, 0.32, -0.32], [0.32, -0.32, -0.32]];
  const QUARK_COLORS = [[1, 0.3, 0.22], [0.3, 1, 0.42], [0.32, 0.5, 1]];
  const PLANETS = [ // [orbit radius, size, colour]
    [6.5, 0.32, 0xb7a58f], [9.5, 0.55, 0xe2c08a], [13, 0.6, 0x3f7fd0], [18, 0.42, 0xc96a44], [26, 1.4, 0xd9b48a]
  ];
  const KEPLER = 7;                           // ω = KEPLER / r^1.5 for the disk and planets
  const POINT_SIZE = 0.42;
  const MAX_DT = 0.05;                        // clamp long frames (tab switch, slow GPU)
  const CAPTION_DELAY_MS = 450;
  const FLASH_MS = 350;
  const CLOSE_FADE_MS = 700;

  /* ── stages ──
     age: [from, to] in seconds after the Big Bang (clock interpolates geometrically when from > 0)
     dur: seconds on screen · blend: seconds to morph from the previous layout
     cam: r = distance, el = elevation (deg), tx = focus x · bg: clear colour (0–1)
     bgRate: how fast the background tint follows · growPoints: enlarge points as the camera pulls back */
  const STAGES = [
    { id: 'origin', title: 'จุดเริ่มต้น', era: '13,800 ล้านปีก่อน · t = 0', age: [0, 1e-43], dur: 6, blend: 1.5,
      cam: { r: 22, el: 12 }, bg: [0, 0, 0],
      txt: 'ทุกสิ่งในเอกภพที่สังเกตได้ เริ่มจากสภาวะที่ร้อนและหนาแน่นอย่างยิ่ง ฟิสิกส์ที่เรารู้จักยังอธิบายช่วงก่อน 10⁻⁴³ วินาทีไม่ได้',
      fact: '<b>ผู้เชี่ยวชาญตรวจทาน:</b> บิกแบงไม่ใช่การระเบิดจากจุดหนึ่งในอวกาศ แต่เป็นการขยายตัวของอวกาศเองทุกแห่งพร้อมกัน ภาพจุดสว่างนี้เป็นเพียงการเปรียบเทียบ' },
    { id: 'inflation', title: 'การพองตัว', era: 'Inflation · 10⁻³⁶ – 10⁻³² วินาที', age: [1e-36, 1e-32], dur: 6, blend: 0.6,
      cam: { r: 46, el: 14 }, bg: [0.05, 0.025, 0.008], flash: 0.9,
      txt: 'อวกาศขยายตัวแบบเอกซ์โพเนนเชียล ขนาดเพิ่มขึ้นอย่างน้อย 10²⁶ เท่าในเสี้ยววินาที ความไม่สม่ำเสมอระดับควอนตัมถูกยืดจนกลายเป็นเมล็ดพันธุ์ของกาแล็กซี',
      fact: '<b>หลักฐาน:</b> รูปแบบอุณหภูมิของรังสีไมโครเวฟพื้นหลังที่ดาวเทียม Planck วัดได้ สอดคล้องกับทฤษฎีการพองตัว' },
    { id: 'quarkGluon', title: 'ซุปควาร์ก–กลูออน', era: '10⁻¹² – 10⁻⁶ วินาที', age: [1e-12, 1e-6], dur: 7, blend: 2.2,
      cam: { r: 58, el: 18 }, bg: [0.08, 0.035, 0.012],
      txt: 'เอกภพร้อนเกินกว่าที่ควาร์กจะจับกลุ่มกัน ควาร์กและกลูออนจึงเคลื่อนที่อิสระ เมื่อเย็นลงถึงราว 1 ไมโครวินาที ควาร์กรวมกันเป็นโปรตอนและนิวตรอน',
      fact: '<b>หมายเหตุ:</b> สีแดง เขียว น้ำเงิน แทน “ประจุสี” ของควาร์กในแรงอย่างเข้ม ไม่ใช่สีที่ตามองเห็น' },
    { id: 'nuclei', title: 'นิวเคลียสแรก', era: '10 วินาที – 20 นาที', age: [10, 1200], dur: 8, blend: 2.6,
      cam: { r: 50, el: 20 }, bg: [0.06, 0.03, 0.012],
      txt: 'โปรตอน (แดง) และนิวตรอน (เทา) หลอมรวมเป็นนิวเคลียสฮีเลียม เมื่อเอกภพขยายตัวจนเย็นลง ปฏิกิริยานิวเคลียร์ก็หยุด จุดสีน้ำเงินจาง ๆ คืออิเล็กตรอนอิสระ',
      fact: '<b>ผลลัพธ์:</b> ไฮโดรเจนราว 75% และฮีเลียมราว 25% โดยมวล ตรงกับองค์ประกอบของดาวฤกษ์ที่เก่าแก่ที่สุด (ย้อนดูบทฟิสิกส์นิวเคลียร์: ฟิวชัน)' },
    { id: 'recombination', title: 'อะตอมแรกและแสงแรก', era: '≈ 380,000 ปี', age: [5e4 * YEAR, 3.8e5 * YEAR], dur: 9, blend: 2.6,
      cam: { r: 82, el: 16 }, bg: [0, 0, 0], bgRate: 0.6, growPoints: true,
      txt: 'เอกภพเย็นลงเหลือราว 3,000 K อิเล็กตรอนถูกนิวเคลียสจับไว้เป็นอะตอม โฟตอนจึงไม่ถูกกระเจิงอีกและพุ่งออกไปอย่างอิสระ เอกภพโปร่งแสงเป็นครั้งแรก',
      fact: '<b>เชื่อมกับบทเรียน:</b> แสงนั้นยังมาถึงเราวันนี้ ถูกยืดจนเป็นคลื่นไมโครเวฟอุณหภูมิ 2.7 K เรียกว่ารังสีไมโครเวฟพื้นหลังของจักรวาล (CMB)' },
    { id: 'firstStars', title: 'ยุคมืดสู่ดาวฤกษ์ดวงแรก', era: '≈ 100 – 400 ล้านปี', age: [1e8 * YEAR, 4e8 * YEAR], dur: 9, blend: 3.5,
      cam: { r: 86, el: 26 }, bg: [0.004, 0.004, 0.009], growPoints: true,
      txt: 'แรงโน้มถ่วงดึงแก๊สในบริเวณที่หนาแน่นกว่าเล็กน้อยให้ยุบตัว แกนกลางร้อนขึ้นจนเกิดฟิวชัน ดาวฤกษ์ดวงแรกจึงจุดแสงขึ้นในความมืด',
      fact: '<b>ธาตุหนัก:</b> คาร์บอน ออกซิเจน และเหล็ก เกิดจากฟิวชันในดาวฤกษ์ แล้วถูกกระจายออกไปด้วยซูเปอร์โนวา' },
    { id: 'galaxy', title: 'กาแล็กซี', era: '≈ 400 ล้าน – หลายพันล้านปี', age: [4e8 * YEAR, 5e9 * YEAR], dur: 10, blend: 3.5,
      cam: { r: 78, el: 42 }, bg: [0.003, 0.003, 0.008], growPoints: true,
      txt: 'ดาวฤกษ์และแก๊สรวมตัวเป็นกาแล็กซี การหมุนทำให้แผ่ออกเป็นจานและเกิดแขนกังหัน ทางช้างเผือกของเราก็เริ่มก่อตัวในยุคนี้',
      fact: '<b>เชื่อมกับบทเรียน:</b> ดาวโคจรรอบใจกลางกาแล็กซีด้วยหลักเดียวกับวงโคจรในบทกลศาสตร์ แรงโน้มถ่วงทำหน้าที่เป็นแรงสู่ศูนย์กลาง' },
    { id: 'solarSystem', title: 'ระบบสุริยะ', era: '4,600 ล้านปีก่อน', age: [9.15e9 * YEAR, 9.25e9 * YEAR], dur: 10, blend: 3.5,
      cam: { r: 58, el: 17 }, bg: [0.004, 0.003, 0.002],
      txt: 'เมฆแก๊สและฝุ่นที่มีธาตุหนักจากดาวรุ่นก่อนยุบตัวและหมุนเป็นจาน ใจกลางกลายเป็นดวงอาทิตย์ เศษในจานชนและรวมกันเป็นดาวเคราะห์',
      fact: '<b>ผู้เชี่ยวชาญตรวจทาน:</b> จานหมุนเร็วขึ้นเมื่อยุบตัว เพราะโมเมนตัมเชิงมุมอนุรักษ์ เหมือนนักสเก็ตที่หุบแขนแล้วหมุนเร็วขึ้น' },
    { id: 'life', title: 'โลกและสิ่งมีชีวิต', era: '4,540 ล้านปีก่อน → ปัจจุบัน', age: [9.25e9 * YEAR, 13.8e9 * YEAR], dur: 14, blend: 3.5,
      cam: { r: 44, el: 10, tx: 11 }, bg: [0.002, 0.002, 0.005],
      txt: 'โลกก่อตัวเมื่อ 4,540 ล้านปีก่อน และหลักฐานของสิ่งมีชีวิตมีอายุอย่างน้อย 3,500 ล้านปี DNA ในเซลล์ของเราประกอบจากอะตอมที่เกิดในบิกแบงและในดาวฤกษ์',
      fact: '<b>ฝุ่นดาว:</b> ไฮโดรเจนในร่างกายเราเกิดในไม่กี่นาทีแรกของเอกภพ ส่วนคาร์บอนและออกซิเจนมาจากดาวฤกษ์ เราจึงสร้างขึ้นจากฝุ่นดาวจริง ๆ' }
  ];
  const LAST = STAGES.length - 1;

  /** The single open session, or null. Every async callback checks `S === session` before acting. */
  let S = null;

  /* ── small pure helpers ── */
  const clamp01 = u => (u <= 0 ? 0 : u >= 1 ? 1 : u);
  const smoothstep = u => { const x = clamp01(u); return x * x * (3 - 2 * x); };
  const approach = (current, target, rate, dt) => current + (target - current) * Math.min(1, dt * rate);
  const prefersReducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function makeRng(seed) {                    // deterministic Park–Miller generator: same universe every time
    let s = seed;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }
  function gaussian(rnd) {
    let u = 0;
    while (u === 0) u = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rnd());
  }
  function writeRandomUnit(rnd, out, j, scale = 1) {
    const x = gaussian(rnd), y = gaussian(rnd), z = gaussian(rnd), l = Math.hypot(x, y, z) || 1;
    out[j] = x / l * scale; out[j + 1] = y / l * scale; out[j + 2] = z / l * scale;
  }

  function fmtAge(sec) {
    if (!(sec > 1e-43)) return '≈ 0 วินาที';            // also catches NaN and negatives
    if (sec < 1e-3) return sci(sec, 1) + ' วินาที';
    if (sec < 60) return sec.toFixed(1) + ' วินาที';
    if (sec < 3600) return (sec / 60).toFixed(1) + ' นาที';
    const years = sec / YEAR;
    if (years < 1e6) return Math.round(years).toLocaleString('en-US') + ' ปี';
    return Math.round(years / 1e6).toLocaleString('en-US') + ' ล้านปี';
  }
  function stageAge(st, u) {
    const [from, to] = st.age;
    return from > 0 ? from * Math.pow(to / from, u) : to * u;
  }

  /* ── textures (canvas-generated, no network) ── */
  function glowTexture(inner, mid) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, inner); grad.addColorStop(0.25, mid); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  function earthTexture() {
    const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), rnd = makeRng(7);
    const sea = g.createLinearGradient(0, 0, 0, H);
    sea.addColorStop(0, '#0d2f5c'); sea.addColorStop(0.5, '#1b5a9a'); sea.addColorStop(1, '#0d2f5c');
    g.fillStyle = sea; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 14; k++) {                        // continents: clusters of blobs, wrapped at the seam
      const cx = rnd() * W, cy = 50 + rnd() * 156, blobs = 18 + rnd() * 30;
      for (let j = 0; j < blobs; j++) {
        const x = cx + (rnd() - 0.5) * 90, y = cy + (rnd() - 0.5) * 50, r = 6 + rnd() * 16;
        g.fillStyle = rnd() < 0.7 ? '#2f6b3a' : '#7a6a45';
        for (const wx of [x, (x + W) % W]) { g.beginPath(); g.arc(wx, y, r, 0, TAU); g.fill(); }
      }
    }
    g.fillStyle = '#e9f0f5'; g.fillRect(0, 0, W, 14); g.fillRect(0, H - 14, W, 14);   // polar ice
    g.globalAlpha = 0.35; g.fillStyle = '#ffffff';                                       // clouds
    for (let j = 0; j < 160; j++) { g.beginPath(); g.ellipse(rnd() * W, 20 + rnd() * 216, 8 + rnd() * 26, 3 + rnd() * 5, 0, 0, TAU); g.fill(); }
    return new THREE.CanvasTexture(c);
  }

  /* ── particle data ── */
  function createParticleData() {
    const rnd = makeRng(12345);
    const d = {
      dir: new Float32Array(PARTICLES * 3),   // random unit direction per particle
      rr: new Float32Array(PARTICLES),        // ∛u → uniform density inside a sphere
      r1: new Float32Array(PARTICLES), r2: new Float32Array(PARTICLES), r3: new Float32Array(PARTICLES),
      centre: new Float32Array(NUCLEI * 3),   // nucleus centres
      clump: new Float32Array(CLUMPS * 3),    // gas clump centres (first stars)
      role: new Uint8Array(PARTICLES),
      nucleus: new Int32Array(PARTICLES).fill(-1),
      slot: new Uint8Array(PARTICLES)         // nucleon slot inside ⁴He, or electron index around it
    };
    for (let i = 0; i < PARTICLES; i++) {
      writeRandomUnit(rnd, d.dir, i * 3);
      d.rr[i] = Math.cbrt(rnd()); d.r1[i] = rnd(); d.r2[i] = rnd(); d.r3[i] = rnd();
    }
    for (let k = 0; k < NUCLEI; k++) writeRandomUnit(rnd, d.centre, k * 3, Math.cbrt(rnd()) * NUCLEUS_RADIUS);
    for (let g = 0; g < CLUMPS; g++) {
      const dist = 12 + rnd() * 30, a = rnd() * TAU;
      d.clump[g * 3] = Math.cos(a) * dist; d.clump[g * 3 + 1] = (rnd() - 0.5) * 30; d.clump[g * 3 + 2] = Math.sin(a) * dist;
    }
    assignRoles(d);
    return d;
  }
  /* 240 ⁴He × 4 nucleons + 2,760 ¹H protons = 3,720 nucleons (2,760 : 240 ≈ 12 : 1 → ~25% He by mass)
     240 × 2 + 2,760 electrons            = 3,240 electrons
     remaining                            = 2,040 LEFTOVER particles */
  function assignRoles({ role, nucleus, slot }) {
    const heNucleons = HELIUM * 4, hydrogen = NUCLEI - HELIUM, nucleons = heNucleons + hydrogen;
    const heElectrons = HELIUM * 2, electrons = heElectrons + hydrogen;
    for (let i = 0; i < PARTICLES; i++) {
      if (i < heNucleons) {
        nucleus[i] = i >> 2; slot[i] = i & 3; role[i] = slot[i] < 2 ? ROLE.PROTON : ROLE.NEUTRON;
      } else if (i < nucleons) {
        nucleus[i] = HELIUM + (i - heNucleons); role[i] = ROLE.PROTON;
      } else {
        const j = i - nucleons;
        if (j < heElectrons) { role[i] = ROLE.ELECTRON; nucleus[i] = j >> 1; slot[i] = j & 1; }
        else if (j < electrons) { role[i] = ROLE.ELECTRON; nucleus[i] = HELIUM + (j - heElectrons); }
        else role[i] = ROLE.LEFTOVER;
      }
    }
  }

  /* ── per-stage layouts: each writes every particle's target position and colour ── */
  function put(s, i, x, y, z, r, g, b) {
    const j = i * 3, p = s.p.toPos, c = s.p.toCol;
    p[j] = x; p[j + 1] = y; p[j + 2] = z; c[j] = r; c[j + 1] = g; c[j + 2] = b;
  }
  function nucleusCentre(d, i, out) {
    const c = d.nucleus[i] * 3;
    out[0] = d.centre[c]; out[1] = d.centre[c + 1]; out[2] = d.centre[c + 2];
  }
  function clumpPosition(d, i, t, out) {      // where a particle sits once its gas clump has collapsed
    const n = d.nucleus[i] >= 0 ? d.nucleus[i] : i, g = n % CLUMPS, q = n * 3;
    const r = 2.6 * d.rr[n] * (1 + 0.08 * Math.sin(t * 1.5 + n));
    out[0] = d.clump[g * 3] + d.dir[q] * r; out[1] = d.clump[g * 3 + 1] + d.dir[q + 1] * r; out[2] = d.clump[g * 3 + 2] + d.dir[q + 2] * r;
  }
  function nucleiLayout(s, t, recombined) {
    const d = s.d, P = s.tmp.p;
    for (let i = 0; i < PARTICLES; i++) {
      const j = i * 3, role = d.role[i];
      if (role === ROLE.PROTON || role === ROLE.NEUTRON) {
        nucleusCentre(d, i, P);
        if (d.nucleus[i] < HELIUM) { const o = HE_OFFSETS[d.slot[i]]; P[0] += o[0]; P[1] += o[1]; P[2] += o[2]; }
        if (recombined) put(s, i, P[0], P[1], P[2], 0.75, 0.62, 0.42);                 // neutral atoms
        else if (role === ROLE.PROTON) put(s, i, P[0], P[1], P[2], 0.95, 0.36, 0.22);
        else put(s, i, P[0], P[1], P[2], 0.6, 0.62, 0.7);
      } else if (recombined && role === ROLE.ELECTRON) {                                // captured into orbit
        nucleusCentre(d, i, P);
        const a = t * 3 + d.r1[i] * TAU + d.slot[i] * Math.PI, R = d.nucleus[i] < HELIUM ? 1.15 : 0.85;
        put(s, i, P[0] + Math.cos(a) * R, P[1] + Math.sin(a) * R * 0.5, P[2] + Math.sin(a) * R, 0.3, 0.42, 0.75);
      } else if (recombined) {                                                          // CMB photons stream away
        const r = d.rr[i] * 40 + t * 16, f = Math.max(0, 1 - t / 8.5);
        put(s, i, d.dir[j] * r, d.dir[j + 1] * r, d.dir[j + 2] * r, 0.95 * f, 0.42 * f, 0.16 * f);
      } else {                                                                          // free plasma particles
        const r = d.rr[i] * 40;
        put(s, i,
          d.dir[j] * r + Math.sin(t * 9 + d.r1[i] * 50) * 1.4,
          d.dir[j + 1] * r + Math.sin(t * 8 + d.r2[i] * 50) * 1.4,
          d.dir[j + 2] * r + Math.sin(t * 10 + d.r3[i] * 50) * 1.4,
          0.22, 0.32, 0.65);
      }
    }
  }
  const LAYOUTS = {
    origin(s, t) {
      const d = s.d;
      for (let i = 0; i < PARTICLES; i++) {
        const j = i * 3, r = d.rr[i] * 0.3 * (1 + 0.2 * Math.sin(t * 3 + d.r1[i] * 6));
        put(s, i, d.dir[j] * r, d.dir[j + 1] * r, d.dir[j + 2] * r, 1, 0.93, 0.76);
      }
    },
    inflation(s, t) {
      const d = s.d, R = 0.3 + 40 * (1 - Math.exp(-t * 1.1));
      for (let i = 0; i < PARTICLES; i++) {
        const j = i * 3, r = d.rr[i] * R;
        put(s, i, d.dir[j] * r, d.dir[j + 1] * r, d.dir[j + 2] * r, 0.95, 0.85 - 0.3 * d.rr[i], 0.7 - 0.5 * d.rr[i]);
      }
    },
    quarkGluon(s, t) {
      const d = s.d, wobble = 0.9, dim = 0.62;
      for (let i = 0; i < PARTICLES; i++) {
        const j = i * 3, r = d.rr[i] * 42, q = QUARK_COLORS[i % 3];
        put(s, i,
          d.dir[j] * r + Math.sin(t * 6 + d.r1[i] * 40) * wobble,
          d.dir[j + 1] * r + Math.sin(t * 7 + d.r2[i] * 40) * wobble,
          d.dir[j + 2] * r + Math.sin(t * 5 + d.r3[i] * 40) * wobble,
          (q[0] * 0.55 + 0.45) * dim, (q[1] * 0.55 + 0.28) * dim, (q[2] * 0.55 + 0.14) * dim);   // tinted toward hot gold
      }
    },
    nuclei(s, t) { nucleiLayout(s, t, false); },
    recombination(s, t) { nucleiLayout(s, t, true); },
    firstStars(s, t) {
      const d = s.d, P = s.tmp.p;
      for (let i = 0; i < PARTICLES; i++) {
        const j = i * 3;
        if (d.role[i] === ROLE.LEFTOVER) {                // photons have left the scene
          const r = 180 + d.rr[i] * 40;
          put(s, i, d.dir[j] * r, d.dir[j + 1] * r, d.dir[j + 2] * r, 0, 0, 0);
          continue;
        }
        clumpPosition(d, i, t, P);
        if (d.role[i] === ROLE.ELECTRON) { const a = t * 3 + d.r1[i] * TAU; P[0] += Math.cos(a) * 0.5; P[2] += Math.sin(a) * 0.5; }
        put(s, i, P[0], P[1], P[2], 0.5, 0.56, 0.78);
      }
    },
    galaxy(s, t) {
      const d = s.d;
      for (let i = 0; i < PARTICLES; i++) {
        const j = i * 3;
        if (i % 7 === 0) {                                // central bulge
          const r = d.rr[i] * 5;
          put(s, i, d.dir[j] * r, d.dir[j + 1] * r * 0.6, d.dir[j + 2] * r, 1, 0.76, 0.44);
          continue;
        }
        const r = 1.5 + 38 * Math.pow(d.r1[i], 0.9), arm = i % 2;
        const ang = arm * Math.PI + 2.3 * Math.log(r) + (d.r2[i] - 0.5) * 0.85 - t * 2.2 / Math.sqrt(r);   // log spiral, differential rotation
        const y = (d.r3[i] - 0.5) * 3 * Math.exp(-r / 14);
        const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
        if (i % 29 === 0) put(s, i, x, y, z, 1, 0.42, 0.62);          // pink star-forming regions
        else if (r < 6) put(s, i, x, y, z, 1, 0.74, 0.44);            // old golden core
        else put(s, i, x, y, z, 0.55, 0.66, 0.95);                    // young blue arms
      }
    },
    solarSystem(s, t) {
      const d = s.d;
      for (let i = 0; i < PARTICLES; i++) {
        const r = 3.4 + 32 * Math.pow(d.r1[i], 1.25), w = KEPLER / Math.pow(r, 1.5);   // Kepler: ω ∝ r^(-3/2)
        const ang = d.r2[i] * TAU + w * t, y = (d.r3[i] - 0.5) * 0.22 * Math.sqrt(r);
        const f = Math.min(1, (r - 3.4) / 30);                                          // hot inner → cool outer
        put(s, i, Math.cos(ang) * r, y, Math.sin(ang) * r, 1 - 0.1 * f, 0.88 - 0.5 * f, 0.62 - 0.55 * f);
      }
    },
    life(s, t) {
      const d = s.d, background = Math.floor(PARTICLES * 0.55), helixCount = PARTICLES - background;
      const x0 = 19, turns = 3.5, R = 2.6, rungs = 46, spin = t * 0.6;
      for (let i = 0; i < PARTICLES; i++) {
        const j = i * 3;
        if (i < background) {                             // distant starfield
          const r = 140 + d.rr[i] * 80, b = 0.18 + 0.4 * d.r1[i];
          put(s, i, d.dir[j] * r, d.dir[j + 1] * r, d.dir[j + 2] * r, b * 0.95, b * 0.95, b);
          continue;
        }
        const m = i - background, u = m / helixCount, kind = m % 3;
        if (kind < 2) {                                   // the two backbone strands
          const a = u * TAU * turns + spin + kind * Math.PI;
          put(s, i, x0 + Math.cos(a) * R, -14 + 28 * u, Math.sin(a) * R, kind ? 0.32 : 0.28, kind ? 0.6 : 0.9, kind ? 0.95 : 0.66);
        } else {                                          // base pairs between them
          const uq = Math.floor(u * rungs) / rungs, a = uq * TAU * turns + spin, along = d.r1[i] * 2 - 1;
          put(s, i, x0 + Math.cos(a) * R * along, -14 + 28 * uq, Math.sin(a) * R * along, 0.85, 0.66, 0.36);
        }
      }
    }
  };

  /* ── overlay DOM ── */
  function createOverlay() {
    const el = document.createElement('div');
    el.className = 'cosmos';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'กำเนิดจักรวาล จากบิกแบงสู่สิ่งมีชีวิต');
    el.innerHTML = `
      <div class="cz-stage"></div><div class="cz-flash"></div>
      <div class="cz-top"><div class="cz-brand">กำเนิดจักรวาล <span>· จากบิกแบงสู่สิ่งมีชีวิต</span></div><button class="cz-btn" data-a="close">ปิด ✕</button></div>
      <div class="cz-hint">ลากเพื่อหมุน · เลื่อนเพื่อซูม · ← → เปลี่ยนฉาก · Space หยุด · Esc ปิด</div>
      <div class="cz-cap" aria-live="polite"><div class="cz-step mono"></div><div class="cz-time mono"></div><h2 class="cz-title"></h2><p class="cz-txt"></p><div class="cz-fact"></div>
        <div class="cz-end"><button class="cz-btn" data-a="replay">↺ เล่นอีกครั้ง</button><button class="cz-btn" data-a="close">กลับสู่บทเรียน</button></div></div>
      <div class="cz-bar">
        <div class="cz-ticks">${STAGES.map((st, i) => `<button data-i="${i}" title="${st.title}" aria-label="ไปฉาก ${i + 1}: ${st.title}"><span>${st.title}</span><i><b></b></i></button>`).join('')}</div>
        <div class="cz-ctrl"><button data-a="prev" title="ฉากก่อนหน้า" aria-label="ฉากก่อนหน้า">‹</button><button data-a="play" title="หยุด/เล่น" aria-label="หยุด" aria-pressed="false">❚❚</button><button data-a="next" title="ฉากถัดไป" aria-label="ฉากถัดไป">›</button></div>
        <div class="cz-clock mono"><small>เวลาหลังบิกแบง</small><span></span></div>
      </div>`;
    const q = sel => el.querySelector(sel);
    const ui = {
      stage: q('.cz-stage'), flash: q('.cz-flash'), cap: q('.cz-cap'),
      step: q('.cz-step'), time: q('.cz-time'), title: q('.cz-title'), txt: q('.cz-txt'), fact: q('.cz-fact'), end: q('.cz-end'),
      ticks: [...el.querySelectorAll('.cz-ticks b')], clock: q('.cz-clock span'),
      playBtn: q('[data-a="play"]'), closeBtn: q('[data-a="close"]'), lastClock: ''
    };
    return { el, ui };
  }

  /* ── session lifecycle ── */
  function open(options = {}) {
    if (S) return;
    if (!window.THREE || !THREE.OrbitControls) { console.warn('Cosmos: Three.js is not available'); return; }
    const { el, ui } = createOverlay();
    const s = {
      el, ui,
      onClose: typeof options.onClose === 'function' ? options.onClose : () => { if (typeof route === 'function') route(true); },
      prevFocus: document.activeElement,
      prevOverflow: document.body.style.overflow,
      reducedMotion: prefersReducedMotion(),
      timers: new Set(), raf: 0,
      k: 0, t: 0, play: true, userCam: false
    };
    s.onKey = e => onKey(s, e);
    s.onClick = e => onClick(s, e);
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    S = s;
    Theme.set('dark');                          // the whole site switches to dark mode with the journey
    try { buildScene(s); }
    catch (err) { console.error('Cosmos: could not start the 3D scene', err); close(); return; }
    el.addEventListener('click', s.onClick);
    window.addEventListener('keydown', s.onKey);
    requestAnimationFrame(() => { if (S === s) el.classList.add('on'); });
    ui.closeBtn.focus({ preventScroll: true });
    flash(s, 1);
    goto(s, 0);
    startLoop(s);
  }

  function close() {
    const s = S;
    if (!s) return;
    S = null;                                    // every pending callback now sees a stale session
    cancelAnimationFrame(s.raf);
    s.timers.forEach(clearTimeout); s.timers.clear();
    window.removeEventListener('keydown', s.onKey);
    s.el.removeEventListener('click', s.onClick);
    if (s.ro) s.ro.disconnect();
    disposeScene(s);
    s.el.classList.remove('on');
    setTimeout(() => s.el.remove(), CLOSE_FADE_MS);
    document.body.style.overflow = s.prevOverflow;
    if (s.prevFocus && typeof s.prevFocus.focus === 'function' && document.contains(s.prevFocus)) s.prevFocus.focus({ preventScroll: true });
    s.onClose();
  }

  /** setTimeout that is cancelled on close and ignored if the session changed. */
  function later(s, fn, ms) {
    const id = setTimeout(() => { s.timers.delete(id); if (S === s) fn(); }, ms);
    s.timers.add(id);
    return id;
  }

  /* ── input ── */
  function onKey(s, e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') goto(s, s.k + 1);
    else if (e.key === 'ArrowLeft') goto(s, s.k - 1);
    else if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); if (!e.repeat) setPlaying(s, !s.play); }
  }
  function onClick(s, e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.i !== undefined) { goto(s, Number(b.dataset.i)); return; }
    switch (b.dataset.a) {
      case 'close': close(); break;
      case 'next': goto(s, s.k + 1); break;
      case 'prev': goto(s, s.k - 1); break;
      case 'play': setPlaying(s, !s.play); break;
      case 'replay': setPlaying(s, true); flash(s, 1); goto(s, 0); break;
    }
  }
  function setPlaying(s, playing) {
    s.play = playing;
    s.ui.playBtn.textContent = playing ? '❚❚' : '▶';
    s.ui.playBtn.setAttribute('aria-label', playing ? 'หยุด' : 'เล่น');
    s.ui.playBtn.setAttribute('aria-pressed', String(!playing));
  }
  function flash(s, strength) {
    if (s.reducedMotion) return;
    s.ui.flash.style.opacity = strength;
    later(s, () => { s.ui.flash.style.opacity = 0; }, FLASH_MS);
  }

  /* ── stage control ── */
  function goto(s, k) {
    if (S !== s || !Number.isFinite(k)) return;
    k = Math.max(0, Math.min(LAST, Math.round(k)));
    const st = STAGES[k];
    s.k = k; s.t = 0; s.userCam = false;
    s.p.fromPos.set(s.p.pos); s.p.fromCol.set(s.p.col);      // snapshot: the new layout blends from here
    if (st.flash) flash(s, st.flash);
    const { ui } = s;
    ui.cap.classList.add('fade');
    if (s.captionTimer) { clearTimeout(s.captionTimer); s.timers.delete(s.captionTimer); }
    s.captionTimer = later(s, () => {
      s.captionTimer = 0;
      ui.step.textContent = `${String(k + 1).padStart(2, '0')} / ${String(STAGES.length).padStart(2, '0')}`;
      ui.time.textContent = st.era;
      ui.title.textContent = st.title;
      ui.txt.textContent = st.txt;
      ui.fact.innerHTML = st.fact;                            // trusted, author-written constant
      ui.end.classList.toggle('on', k === LAST);
      ui.cap.classList.remove('fade');
    }, CAPTION_DELAY_MS);
  }

  /* ── scene construction ── */
  function buildScene(s) {
    const { stage } = s.ui;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 1);
    stage.appendChild(renderer.domElement);
    s.renderer = renderer;                                     // stored first so a later failure still disposes it

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 3000);
    camera.position.set(0, 4, 22);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    Object.assign(controls, {
      enableDamping: true, dampingFactor: 0.06, enablePan: false, minDistance: 3, maxDistance: 600,
      autoRotate: !s.reducedMotion, autoRotateSpeed: 0.35
    });
    controls.addEventListener('start', () => { s.userCam = true; });   // the viewer takes the camera until the next stage
    Object.assign(s, { scene, camera, controls });

    scene.add(new THREE.AmbientLight(0xffffff, 0.12));
    const sunLight = new THREE.PointLight(0xffd8a0, 0, 400); scene.add(sunLight);
    const keyLight = new THREE.DirectionalLight(0xfff1dc, 0); keyLight.position.set(-30, 12, 20); scene.add(keyLight);

    // particles
    s.d = createParticleData();
    const n3 = PARTICLES * 3;
    s.p = {
      pos: new Float32Array(n3), col: new Float32Array(n3),
      fromPos: new Float32Array(n3), fromCol: new Float32Array(n3),
      toPos: new Float32Array(n3), toCol: new Float32Array(n3)
    };
    for (let i = 0; i < n3; i++) s.p.pos[i] = s.d.dir[i] * 0.05;     // everything starts at the centre
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(s.p.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(s.p.col, 3));
    const pointsMat = new THREE.PointsMaterial({
      size: POINT_SIZE, map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,.45)'), vertexColors: true,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    });
    const points = new THREE.Points(geo, pointsMat); points.frustumCulled = false; scene.add(points);

    // stage objects
    const additiveSprite = (map, color, scale) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      sp.scale.setScalar(scale); scene.add(sp); return sp;
    };
    const flare = additiveSprite(glowTexture('rgba(255,250,235,1)', 'rgba(255,205,130,.5)'), 0xffe6b0, 6);
    const starTex = glowTexture('rgba(255,255,255,1)', 'rgba(170,200,255,.5)');
    const stars = [];
    for (let g = 0; g < CLUMPS; g++) {
      const star = additiveSprite(starTex, 0xbcd2ff, 4.5);
      star.position.fromArray(s.d.clump, g * 3); stars.push(star);
    }
    const sunGlow = additiveSprite(glowTexture('rgba(255,248,225,1)', 'rgba(255,190,90,.55)'), 0xffd28a, 16);
    const sunCore = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 20), new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0 }));
    scene.add(sunCore);
    const planets = PLANETS.map(([radius, size, color], q) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(size, 24, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.8, transparent: true, opacity: 0 }));
      m.userData = { radius, phase: q * 1.7 }; scene.add(m); return m;
    });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(5.5, 64, 40), new THREE.MeshStandardMaterial({ map: earthTexture(), roughness: 0.85, transparent: true, opacity: 0 }));
    earth.rotation.z = THREE.MathUtils.degToRad(23.4); earth.position.x = 4; scene.add(earth);    // axial tilt
    const atmosphere = additiveSprite(glowTexture('rgba(120,180,255,0)', 'rgba(110,170,255,.35)'), 0x8fc2ff, 15);
    atmosphere.position.x = 4;

    Object.assign(s, {
      geo, pointsMat,
      obj: { flare, stars, sunGlow, sunCore, sunLight, keyLight, planets, earth, atmosphere },
      bg: new THREE.Color(0, 0, 0), focus: new THREE.Vector3(),
      tmp: { p: new Float32Array(3), color: new THREE.Color(), target: new THREE.Vector3(), offset: new THREE.Vector3(), sph: new THREE.Spherical() }
    });

    const resize = () => {
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;                                    // hidden or not laid out yet
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    s.ro = new ResizeObserver(resize); s.ro.observe(stage); resize();
  }

  function disposeScene(s) {
    if (!s.renderer) return;
    const freed = new Set();                                   // shared textures/materials are freed once
    const free = x => { if (x && !freed.has(x)) { freed.add(x); x.dispose(); } };
    if (s.scene) s.scene.traverse(o => {
      free(o.geometry);
      [].concat(o.material || []).forEach(m => { free(m.map); free(m); });
    });
    if (s.controls) s.controls.dispose();
    s.renderer.dispose();
    s.renderer.forceContextLoss();                             // release the WebGL context now, not at GC
    s.renderer.domElement.remove();
  }

  /* ── per frame ── */
  function startLoop(s) {
    let last = performance.now();
    const tick = now => {
      if (S !== s) return;
      s.raf = requestAnimationFrame(tick);
      const dt = Math.min(MAX_DT, Math.max(0, (now - last) / 1000));
      last = now;
      frame(s, dt);
    };
    s.raf = requestAnimationFrame(tick);
  }

  function frame(s, dt) {
    if (s.play) {
      s.t += dt;
      if (s.t > STAGES[s.k].dur && s.k < LAST) goto(s, s.k + 1);
    }
    const st = STAGES[s.k];
    LAYOUTS[st.id](s, s.t);
    blendParticles(s, st);
    updateBackground(s, st, dt);
    updateStageObjects(s, st, dt);
    updateCamera(s, st, dt);
    s.renderer.render(s.scene, s.camera);
    updateHud(s, st);
  }

  function blendParticles(s, st) {
    const w = smoothstep(s.t / st.blend), { pos, col, fromPos, fromCol, toPos, toCol } = s.p;
    for (let i = 0, n = pos.length; i < n; i++) {
      pos[i] = fromPos[i] + (toPos[i] - fromPos[i]) * w;
      col[i] = fromCol[i] + (toCol[i] - fromCol[i]) * w;
    }
    s.geo.attributes.position.needsUpdate = true;
    s.geo.attributes.color.needsUpdate = true;
  }

  function updateBackground(s, st, dt) {
    s.tmp.color.setRGB(st.bg[0], st.bg[1], st.bg[2]);
    s.bg.lerp(s.tmp.color, Math.min(1, dt * (st.bgRate || 1.2)));
    s.renderer.setClearColor(s.bg, 1);
  }

  function updateStageObjects(s, st, dt) {
    const t = s.t, id = st.id, o = s.obj;
    const fadeTo = (obj, target, rate = 1.5) => { obj.material.opacity = approach(obj.material.opacity, target, rate, dt); };

    // Big Bang flare: glows in "origin", blows outward at the start of "inflation"
    o.flare.material.opacity = id === 'origin' ? clamp01(t / 2) * (0.75 + 0.25 * Math.sin(t * 5))
      : id === 'inflation' ? Math.max(0, 1 - t / 1.4) : 0;
    o.flare.scale.setScalar(id === 'origin' ? 4 + t * 1.2 : id === 'inflation' ? 11 + t * 60 : 4);

    // first stars ignite one after another
    const starsOn = id === 'firstStars';
    o.stars.forEach((star, g) => {
      const on = starsOn ? clamp01((t - 3 - g * 0.09) / 1.2) : 0;
      fadeTo(star, on * (0.8 + 0.2 * Math.sin(t * 3 + g)), starsOn ? 3 : 1.2);
      star.scale.setScalar(3.5 + 2 * on);
    });

    // Sun and planets
    const solar = id === 'solarSystem';
    fadeTo(o.sunGlow, solar ? clamp01(t / 3) : 0);
    fadeTo(o.sunCore, solar ? clamp01(t / 3) : 0);
    o.sunGlow.scale.setScalar(14 + Math.sin(t * 2) * 0.6);
    o.sunLight.intensity = approach(o.sunLight.intensity, solar ? 2.2 : 0, 2, dt);
    o.planets.forEach((planet, q) => {
      const grow = solar ? clamp01((t - 3 - q * 0.6) / 2.5) : 0;            // accretion: inner planets first
      fadeTo(planet, grow, 2);
      planet.scale.setScalar(0.2 + 0.8 * grow);
      const { radius, phase } = planet.userData, a = phase + KEPLER / Math.pow(radius, 1.5) * t;
      planet.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    });

    // Earth
    const life = id === 'life';
    fadeTo(o.earth, life ? clamp01(t / 3) : 0);
    fadeTo(o.atmosphere, life ? Math.min(0.85, t / 3) : 0);
    o.earth.rotation.y += dt * 0.12;
    o.keyLight.intensity = approach(o.keyLight.intensity, life ? 1.3 : 0, 2, dt);
  }

  function updateCamera(s, st, dt) {
    const { camera, controls, tmp } = s, cam = st.cam;
    tmp.target.set(cam.tx || 0, 0, 0);
    s.focus.lerp(tmp.target, Math.min(1, dt * 0.8));
    controls.target.copy(s.focus);
    if (!s.userCam) {                                          // drift toward the stage framing
      const k = Math.min(1, dt * 0.7);
      tmp.sph.setFromVector3(tmp.offset.copy(camera.position).sub(s.focus));
      tmp.sph.radius += (cam.r - tmp.sph.radius) * k;
      tmp.sph.phi += (Math.PI / 2 - THREE.MathUtils.degToRad(cam.el) - tmp.sph.phi) * k;
      camera.position.copy(s.focus).add(tmp.offset.setFromSpherical(tmp.sph));
    }
    controls.update();
    // keep points legible when the camera pulls far back for the large-scale stages
    s.pointsMat.size = st.growPoints ? Math.min(1.2, 0.34 + camera.position.distanceTo(s.focus) * 0.009) : POINT_SIZE;
  }

  function updateHud(s, st) {
    const u = clamp01(s.t / st.dur);
    s.ui.ticks.forEach((bar, i) => { bar.style.width = (i < s.k ? 100 : i > s.k ? 0 : 100 * u) + '%'; });
    const clock = fmtAge(stageAge(st, u));
    if (clock !== s.ui.lastClock) { s.ui.clock.textContent = clock; s.ui.lastClock = clock; }
  }

  return { open, close, isOpen: () => S !== null };
})();
