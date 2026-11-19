// Unit tests for the cosmology / timeline module. Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../assets/js/cosmos/cosmos-physics.js');

const YR = () => P.CONST.YEAR_S;

test('age at a=1 is 13.8 Gyr ±1%', () => { const gyr = P.ageNow() / YR() / 1e9; assert.ok(gyr > 13.66 && gyr < 13.94, gyr); });
test('scale factor at 380 kyr ≈ 1/1100 ±10%', () => { const a = P.scaleFactor(3.8e5 * YR()); assert.ok(a > 1 / 1210 && a < 1 / 990, a); });
test('temperature at 380 kyr ≈ 3000 K ±15%', () => { const T = P.temperature(3.8e5 * YR()); assert.ok(T > 2550 && T < 3450, T); });
test('temperature at 1 s is ~1e10 K', () => { const T = P.temperature(1); assert.ok(T > 3e9 && T < 3e10, T); });
test('temperature today is T0', () => { assert.ok(Math.abs(P.temperature(P.ageNow()) - 2.7255) < 0.01); });
test('scale factor is increasing', () => {
  let prev = 0;
  for (let e = -43; e <= 17.6; e += 0.05) { const a = P.scaleFactor(10 ** e); assert.ok(a > prev, e); prev = a; }
});
test('slider round-trips and is monotonic', () => {
  let prev = -1;
  for (let i = 0; i <= 1000; i++) {
    const u = i / 1000, t = P.sliderToTime(u);
    assert.ok(Math.abs(P.timeToSlider(t) - u) < 1e-9, u);
    assert.ok(t > prev); prev = t;
  }
});
test('slider ends hit the timeline ends', () => {
  assert.equal(P.sliderToTime(0), 1e-43);
  assert.ok(Math.abs(P.sliderToTime(1) / P.ageNow() - 1) < 1e-9);
  assert.equal(P.sliderToTime(-1), 1e-43);
});
test('eras are contiguous, widths sum to 1, every t has an era', () => {
  const E = P.ERAS;
  assert.ok(Math.abs(E.reduce((s, e) => s + e.width, 0) - 1) < 1e-9);
  for (let i = 1; i < E.length; i++) assert.equal(E[i].start, E[i - 1].end);
  for (let e = -43; e <= 17.6; e += 0.01) assert.ok(P.eraAt(10 ** Math.min(e, Math.log10(P.ageNow()))), e);
});
test('key events sit in the right eras', () => {
  assert.equal(P.eraAt(1e-6).id, 'quark');
  assert.equal(P.eraAt(180).id, 'nucleo');
  assert.equal(P.eraAt(3.8e5 * YR()).id, 'recomb');
  assert.equal(P.eraAt(1e9 * YR()).id, 'cosmicDawn');
  assert.equal(P.eraAt(4.0e9 * YR() + 9.2e9 * YR()).id, 'solar');
});
test('main eras have expert facts, bridges do not', () => { for (const e of P.ERAS) assert.equal(!!e.fact, e.kind === 'main', e.id); });
test('mandatory physics corrections are present', () => {
  const all = P.ERAS.map(e => e.text + ' ' + (e.fact || '')).join(' ');
  for (const s of ['ไม่มีจุดศูนย์กลาง', '10⁻⁶', 'โดยมวล', '2.7 K']) assert.ok(all.includes(s), s);
});
test('formatting', () => {
  assert.equal(P.formatTime(1e-43), '≈ 0 วินาที');
  assert.match(P.formatTime(1e-35), /× 10⁻³⁵ วินาที$/);
  assert.match(P.formatTime(3.8e5 * YR()), /^380,000 ปี$/);
  assert.match(P.formatTime(P.ageNow()), /พันล้านปี$/);
  assert.equal(P.formatSci(1.5e26, 1), '1.5 × 10²⁶');
});
