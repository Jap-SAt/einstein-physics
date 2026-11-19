/* ════════════════ cosmos-physics: เวลา จักรวาล และยุคต่าง ๆ ════════════════
   Pure functions, no DOM / THREE. Loaded as a classic script (global CosmosPhysics) and,
   for tests, through Node's require().

   Cosmology: flat ΛCDM with Planck 2018 parameters (H₀ = 67.4 km/s/Mpc, Ωm = 0.315,
   Ωr ≈ 9.1×10⁻⁵ incl. neutrinos, ΩΛ = 1 − Ωm − Ωr), T₀ = 2.7255 K (Fixsen 2009).
   a(t) comes from integrating the Friedmann equation; inflation is a simple illustrative
   model (60 e-folds between 10⁻³⁶ and 10⁻³² s), flagged as approximate in the HUD. */
const CosmosPhysics = (() => {
  'use strict';

  const YEAR_S = 3.15576e7;
  const CONST = {
    YEAR_S,
    T0_K: 2.7255,
    H0_PER_S: 67.4 / 3.0857e19,            // km/s/Mpc → 1/s
    OMEGA_M: 0.315,
    OMEGA_R: 9.1e-5,
    OMEGA_L: 1 - 0.315 - 9.1e-5,
    T_START: 1e-43,                         // Planck time; stands in for t = 0
    T_INF_START: 1e-36,
    T_INF_END: 1e-32,
    INFLATION_EFOLDS: 60
  };
  const { H0_PER_S: H0, OMEGA_M: OM, OMEGA_R: OR, OMEGA_L: OL } = CONST;

  /* ── a(t) table from the Friedmann equation: dt = d(ln a) / H(a) ── */
  const TABLE_POINTS = 6000, LN_A_MIN = Math.log(1e-30);
  const lnA = new Float64Array(TABLE_POINTS), lnT = new Float64Array(TABLE_POINTS);
  const hubble = a => H0 * Math.sqrt(OR / (a * a * a * a) + OM / (a * a * a) + OL);
  const radiationTime = a => (a * a) / (2 * H0 * Math.sqrt(OR));          // exact while radiation dominates
  const radiationScale = t => Math.sqrt(2 * H0 * Math.sqrt(OR) * t);
  (function buildTable() {
    const step = -LN_A_MIN / (TABLE_POINTS - 1);
    let t = radiationTime(Math.exp(LN_A_MIN));
    let prevInv = 1 / hubble(Math.exp(LN_A_MIN));
    lnA[0] = LN_A_MIN; lnT[0] = Math.log(t);
    for (let i = 1; i < TABLE_POINTS; i++) {
      const la = LN_A_MIN + i * step, inv = 1 / hubble(Math.exp(la));
      t += 0.5 * (prevInv + inv) * step;                                    // trapezoid in ln a
      prevInv = inv; lnA[i] = la; lnT[i] = Math.log(t);
    }
  })();
  const AGE_NOW = Math.exp(lnT[TABLE_POINTS - 1]);
  const ageNow = () => AGE_NOW;

  function tableScale(t) {
    const lt = Math.log(t);
    if (lt <= lnT[0]) return radiationScale(t);
    if (lt >= lnT[TABLE_POINTS - 1]) {                                      // tiny extrapolation past today
      const k = TABLE_POINTS - 1, slope = (lnA[k] - lnA[k - 1]) / (lnT[k] - lnT[k - 1]);
      return Math.exp(lnA[k] + slope * (lt - lnT[k]));
    }
    let lo = 0, hi = TABLE_POINTS - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (lnT[mid] <= lt) lo = mid; else hi = mid; }
    const f = (lt - lnT[lo]) / (lnT[hi] - lnT[lo]);
    return Math.exp(lnA[lo] + f * (lnA[hi] - lnA[lo]));
  }
  const A_INF_END = tableScale(CONST.T_INF_END);
  function scaleFactor(t) {
    const { T_INF_START: t0, T_INF_END: t1, INFLATION_EFOLDS: N } = CONST;
    if (t >= t1) return tableScale(t);
    if (t >= t0) return A_INF_END * Math.exp(-N * (t1 - t) / (t1 - t0));   // exponential expansion
    return A_INF_END * Math.exp(-N) * Math.sqrt(t / t0);                    // hot phase before inflation
  }

  /* ── temperature ── */
  const T_PLANCK = 1.4e32;
  const earlyRadiationT = t => 1.5e10 / Math.sqrt(t);                       // T[K] ≈ 1.5×10¹⁰ (t/1 s)^−½
  const T_PRE_INFLATION = T_PLANCK * Math.sqrt(CONST.T_START / CONST.T_INF_START);
  const T_REHEAT = earlyRadiationT(CONST.T_INF_END);
  const REHEAT_FRACTION = 0.02;                                              // last 2% of inflation
  function temperature(t) {
    const { T_INF_START: t0, T_INF_END: t1, INFLATION_EFOLDS: N } = CONST;
    if (t >= 1) return CONST.T0_K / scaleFactor(t);
    if (t >= t1) return earlyRadiationT(t);
    if (t >= t0) {                                                           // supercooling, then reheating
      const f = (t - t0) / (t1 - t0), coldest = T_PRE_INFLATION * Math.exp(-N * (1 - REHEAT_FRACTION));
      if (f < 1 - REHEAT_FRACTION) return T_PRE_INFLATION * Math.exp(-N * f);
      const g = (f - (1 - REHEAT_FRACTION)) / REHEAT_FRACTION;
      return Math.exp(Math.log(coldest) + g * (Math.log(T_REHEAT) - Math.log(coldest)));
    }
    return T_PLANCK * Math.sqrt(CONST.T_START / Math.max(t, CONST.T_START));
  }
  const isTemperatureApprox = t => t < 1e-12;
  /** before the end of inflation both a(t) and T(t) depend on the inflation model */
  const isModelDependent = t => t < CONST.T_INF_END;
  /** temperature for the HUD: during inflation the model's supercool-then-reheat dip (down to ~10³ K) would read as
      "colder than recombination", so the HUD glides log-linearly from T(start of inflation) to the reheating
      temperature and is flagged as model-dependent instead. Visuals and audio still use temperature(). */
  function hudTemperature(t) {
    const { T_INF_START: t0, T_INF_END: t1 } = CONST;
    if (t < t0 || t >= t1) return temperature(t);
    const f = (Math.log(t) - Math.log(t0)) / (Math.log(t1) - Math.log(t0));
    return Math.exp(Math.log(T_PRE_INFLATION) + f * (Math.log(T_REHEAT) - Math.log(T_PRE_INFLATION)));
  }

  /* ── eras (piecewise-log timeline) ── */
  const yr = y => y * YEAR_S;
  const ERAS = [
    { id: 'inflation', kind: 'main', start: CONST.T_START, end: 1e-32, width: 0.14, dur: 10,
      title: 'ยุคพลังค์และการพองตัว',
      text: 'เอกภพเริ่มจากสภาวะที่ร้อนและหนาแน่นอย่างยิ่ง แล้วอวกาศพองตัวแบบเอกซ์โพเนนเชียลอย่างน้อย 10²⁶ เท่าในเสี้ยววินาที',
      fact: 'บิกแบงไม่ใช่การระเบิดจากจุดหนึ่งในอวกาศ แต่เป็นการขยายตัวของอวกาศเองทุกแห่งพร้อมกัน ในภาพเราจึงอยู่ข้างในเอกภพที่ร้อนและยืดออกรอบตัว ไม่ได้มองลูกไฟจากข้างนอก',
      grade: { bloom: 2.4, tint: [0.85, 0.92, 1.0], exposure: 1.25 } },
    { id: 'electroweak', kind: 'bridge', start: 1e-32, end: 1e-12, width: 0.05, dur: 5,
      title: 'ยุคแห่งความร้อน',
      text: 'หลังการพองตัว พลังงานกลายเป็นอนุภาคร้อนจัด แรงพื้นฐานค่อย ๆ แยกออกจากกันขณะเอกภพเย็นลง',
      fact: null, grade: { bloom: 1.5, tint: [1.0, 0.92, 0.8], exposure: 1.0 } },
    { id: 'quark', kind: 'main', start: 1e-12, end: 1, width: 0.14, dur: 12,
      title: 'พลาสมาควาร์ก–กลูออน',
      text: 'ควาร์กและกลูออนเคลื่อนที่อิสระในซุปร้อนจัด เมื่อเย็นลงถึงราว 10⁻⁶ วินาที ควาร์กจับกลุ่มกันสามตัวเป็นโปรตอนและนิวตรอน',
      fact: '“สี” แดง เขียว น้ำเงินของควาร์กคือประจุสีของแรงอย่างเข้ม ไม่ใช่สีที่ตามองเห็น และควาร์กรวมเป็นโปรตอนที่ราว 10⁻⁶ วินาที ไม่ใช่ในยุคสร้างนิวเคลียส',
      grade: { bloom: 1.1, tint: [1.0, 0.82, 0.62], exposure: 0.95 } },
    { id: 'nucleo', kind: 'main', start: 1, end: 1200, width: 0.13, dur: 12,
      title: 'นิวคลีโอซินทีซิส',
      text: 'โปรตอนและนิวตรอนหลอมรวมเป็นนิวเคลียสดิวเทอเรียมและฮีเลียมในไม่กี่นาที แล้วปฏิกิริยาก็หยุดเพราะเอกภพขยายตัวจนเย็นลง',
      fact: 'ผลลัพธ์คือไฮโดรเจนราว 75% และฮีเลียมราว 25% โดยมวล หรือประมาณ 12 ต่อ 1 เมื่อนับจำนวนนิวเคลียส',
      grade: { bloom: 1.4, tint: [1.0, 0.78, 0.5], exposure: 1.05 } },
    { id: 'radiation', kind: 'bridge', start: 1200, end: yr(2.5e5), width: 0.05, dur: 5,
      title: 'ยุครังสี',
      text: 'เอกภพเต็มไปด้วยพลาสมาร้อนที่แสงทะลุผ่านไม่ได้ โฟตอนชนอิเล็กตรอนอิสระไปมาเหมือนอยู่ในหมอกหนา',
      fact: null, grade: { bloom: 1.2, tint: [1.0, 0.7, 0.45], exposure: 1.0 } },
    { id: 'recomb', kind: 'main', start: yr(2.5e5), end: yr(1e8), width: 0.14, dur: 14,
      title: 'อะตอมแรกและแสงแรก',
      text: 'ราว 380,000 ปี เอกภพเย็นลงเหลือราว 3,000 K อิเล็กตรอนถูกนิวเคลียสจับไว้เป็นอะตอม แสงจึงเดินทางได้อิสระเป็นครั้งแรก จากนั้นเอกภพเข้าสู่ยุคมืด',
      fact: 'นี่ไม่ใช่แสงที่เกิดใหม่ แต่เป็นแสงที่หลุดออกมาได้เป็นครั้งแรก วันนี้ถูกยืดจนเป็นไมโครเวฟอุณหภูมิ 2.7 K เรียกว่ารังสีไมโครเวฟพื้นหลังของจักรวาล (CMB)',
      grade: { bloom: 1.1, tint: [1.0, 0.62, 0.45], exposure: 0.95 } },
    { id: 'cosmicDawn', kind: 'main', start: yr(1e8), end: yr(9.2e9), width: 0.18, dur: 22,
      title: 'รุ่งอรุณของดาวและกาแล็กซี',
      text: 'แก๊สยุบตัวด้วยแรงโน้มถ่วงเป็นใยจักรวาล ดาวฤกษ์รุ่นแรกจุดแสงสีฟ้า แล้วรวมกันเป็นกาแล็กซีกังหันที่ถอยห่างจากกันตามการขยายตัวของอวกาศ',
      fact: 'กฎของฮับเบิล: ทุกกาแล็กซีเห็นกาแล็กซีอื่นถอยห่างด้วยความเร็วแปรผันตามระยะทาง เอกภพจึงไม่มีจุดศูนย์กลางของการขยายตัว ส่วนธาตุหนักเกิดในดาวฤกษ์และซูเปอร์โนวา',
      grade: { bloom: 1.3, tint: [0.78, 0.86, 1.0], exposure: 1.0 } },
    { id: 'solar', kind: 'main', start: yr(9.2e9), end: AGE_NOW, width: 0.17, dur: 25,
      title: 'ระบบสุริยะ โลก และสิ่งมีชีวิต',
      text: 'เมื่อ 4,600 ล้านปีก่อน เมฆแก๊สที่มีธาตุหนักยุบตัวเป็นดวงอาทิตย์และดาวเคราะห์ โลกก่อตัวเมื่อ 4,540 ล้านปีก่อน และมีหลักฐานของสิ่งมีชีวิตอย่างน้อย 3,500 ล้านปี',
      fact: 'ไฮโดรเจนในร่างกายเราเกิดในไม่กี่นาทีแรกของเอกภพ ส่วนคาร์บอนและออกซิเจนมาจากดาวฤกษ์ เราจึงสร้างขึ้นจากฝุ่นดาวจริง ๆ',
      grade: { bloom: 1.2, tint: [1.0, 0.9, 0.75], exposure: 1.05 } }
  ];
  const CUM = [];                                                            // cumulative slider offset of each era
  ERAS.reduce((acc, e, i) => { CUM[i] = acc; return acc + e.width; }, 0);

  function eraIndexAt(t) {
    for (let i = ERAS.length - 1; i > 0; i--) if (t >= ERAS[i].start) return i;
    return 0;
  }
  const eraAt = t => ERAS[eraIndexAt(t)];
  function eraProgress(t) {
    const e = eraAt(t), lt = Math.log10(Math.min(Math.max(t, e.start), e.end));
    return (lt - Math.log10(e.start)) / (Math.log10(e.end) - Math.log10(e.start));
  }
  function timeToSlider(t) {
    const tc = Math.min(Math.max(t, CONST.T_START), AGE_NOW), i = eraIndexAt(tc);
    return CUM[i] + eraProgress(tc) * ERAS[i].width;
  }
  function sliderToTime(u) {
    if (!(u > 0)) return CONST.T_START;
    if (u >= 1) return AGE_NOW;
    let i = ERAS.length - 1;
    while (i > 0 && u < CUM[i]) i--;
    const e = ERAS[i], f = (u - CUM[i]) / e.width;
    return Math.pow(10, Math.log10(e.start) + f * (Math.log10(e.end) - Math.log10(e.start)));
  }

  /* ── formatting ── */
  const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  function formatSci(x, digits = 2) {
    if (!isFinite(x) || x === 0) return '0';
    let e = Math.floor(Math.log10(Math.abs(x))), m = (x / Math.pow(10, e)).toFixed(digits);
    if (Math.abs(parseFloat(m)) >= 10) { e += 1; m = (x / Math.pow(10, e)).toFixed(digits); }   // 9.99 → 10.0 rounding
    return `${m} × 10${String(e).split('').map(c => SUP[c]).join('')}`;
  }
  function formatTime(t) {
    if (!(t > CONST.T_START * 1.000001)) return '≈ 0 วินาที';
    if (t < 1e-3) return formatSci(t, 1) + ' วินาที';
    if (t < 60) return t.toFixed(1) + ' วินาที';
    if (t < 3600) return (t / 60).toFixed(1) + ' นาที';
    if (t < 86400) return (t / 3600).toFixed(1) + ' ชั่วโมง';
    const y = t / YEAR_S;
    if (y < 1) return Math.round(t / 86400).toLocaleString('en-US') + ' วัน';
    if (y < 1e6) return Math.round(y).toLocaleString('en-US') + ' ปี';
    if (y < 1e9) return Math.round(y / 1e6).toLocaleString('en-US') + ' ล้านปี';
    return (y / 1e9).toFixed(2) + ' พันล้านปี';
  }

  return {
    CONST, ERAS, ageNow, scaleFactor, temperature, isTemperatureApprox, isModelDependent, hudTemperature,
    eraIndexAt, eraAt, eraProgress, timeToSlider, sliderToTime, formatTime, formatSci
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = CosmosPhysics;
