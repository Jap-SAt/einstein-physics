const test = require('node:test');
const assert = require('node:assert/strict');
const PC = require('../assets/js/practice/practice-core.js');

const near = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);

test('rng is deterministic', () => {
  const a = PC.makeRng(7), b = PC.makeRng(7);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
  const r = PC.makeRng(123);
  for (let i = 0; i < 1000; i++) { const v = r(); assert.ok(v >= 0 && v < 1); }
});

test('pick stays on grid', () => {
  const rng = PC.makeRng(1);
  for (let i = 0; i < 1000; i++) {
    const x = PC.pick(rng, 5, 20, 0.5);
    assert.ok(x >= 5 && x <= 20);
    assert.equal((x * 2) % 1, 0);
  }
});

test('parse formats', () => {
  for (const s of ['0.021', '.021', '2.1e-2', '2.1E-2', '2.1×10^-2', '2.1x10^-2', '2.1*10^-2', '2.1 × 10⁻²', ' 2.1e-2 ']) {
    near(PC.parseAnswer(s), 0.021);
  }
  assert.equal(PC.parseAnswer('12,000'), 12000);
  assert.equal(PC.parseAnswer('−4.2'), -4.2);
  assert.equal(PC.parseAnswer('-4.2'), -4.2);
  for (const s of ['abc', '', '1.2.3']) assert.equal(PC.parseAnswer(s), null);
});

test('parse powers of ten written with parentheses', () => {
  for (const s of ['2.4 x 10^(-13)', '2.4*10^(-13)', '2.4×10^(−13)', '2.4 × 10^( -13 )', '2.4x10^{-13}', '2.4 X 10^(-13) N'])
    near(PC.parseAnswer(s), 2.4e-13, 1e-25);
  near(PC.parseAnswer('3×10^(8)'), 3e8, 1e-4);
});

test('parse rejects a half-written power of ten instead of returning the mantissa', () => {
  for (const s of ['2.4 x 10-13', '2.4×10-13', '2.4*10 -13', '2.4 x 10', '2.4 × 10^', '2.4x10^(-13', '2.4 x 10^(abc)', '2.4 *', '2.4e(-13)', '2.4 × 1.0'])
    assert.equal(PC.parseAnswer(s), null, s);
});

test('parse strips trailing unit text', () => {
  for (const s of ['7.35 m', '7.35 เมตร', '7.35m/s']) assert.equal(PC.parseAnswer(s), 7.35);
  near(PC.parseAnswer('3 × 10^8 m/s'), 3e8, 1e-4);
  for (const [s, v] of [['71.6°', 71.6], ['2.3µT', 2.3], ['2.3μT', 2.3], ['56%', 56], ['10Ω', 10], ['2.3 µT', 2.3], ['71.6° ทางเหนือ', 71.6]])
    assert.equal(PC.parseAnswer(s), v, s);
});

test('parse rejects digits after a symbol unit instead of a partial number', () => {
  for (const s of ['71.6°5', '5%3', '2.3µ4T', '5%.3', '5° 3', '5%-3', '2.3 µ4T', '10Ω 2'])
    assert.equal(PC.parseAnswer(s), null, s);
});

test('parse joins thousands groups separated by single spaces', () => {
  assert.equal(PC.parseAnswer('10 980'), 10980);
  assert.equal(PC.parseAnswer('1 234 567.5'), 1234567.5);
  assert.equal(PC.parseAnswer('-12 000'), -12000);
  assert.equal(PC.parseAnswer('10 980 รอบ'), 10980);
  assert.equal(PC.parseAnswer('1 234.5 m'), 1234.5);
});

test('parse rejects a number followed by a space and more digits instead of a partial number', () => {
  for (const s of ['10 98', '2.5 3', '10  980', '1 2345', '12.5 000', '1 234 56', '10 980 5', '0 123'])
    assert.equal(PC.parseAnswer(s), null, s);
});

test('parse never turns an input into a different number (review finding 1)', () => {
  // a leading "0," group is a decimal comma, never thousands; other non-thousands commas are decimal commas
  for (const [s, v] of [['0,021', 0.021], ['-0,021', -0.021], ['−0,021', -0.021], ['0,5', 0.5], ['3,14', 3.14], ['2,1e-2', 0.021]])
    near(PC.parseAnswer(s), v, 1e-12);
  // a power of ten written with a space before e/E
  for (const s of ['2.1 e-2', '2.1 E-2', '2.1 e -2']) near(PC.parseAnswer(s), 0.021, 1e-12);
  // middle dots as the multiplication sign
  for (const s of ['2.1 · 10^-2', '2.1 ⋅ 10^-2', '2.1·10^-2', '2.1 ⋅ 10^(-2)', '2.1 · 10⁻²']) near(PC.parseAnswer(s), 0.021, 1e-12);
  // half-written powers are unreadable, never the bare mantissa
  for (const s of ['2.1e', '2.1 e', '2.1E', '2.1 e-', '2.1 · 10-2', '2.1 ⋅ 10', '2.1 ·'])
    assert.equal(PC.parseAnswer(s), null, s);
  // a letter unit that starts with e stays a unit
  assert.equal(PC.parseAnswer('7.35 eV'), 7.35);
  assert.equal(PC.parseAnswer('7.35eV'), 7.35);
});

test('parse regression set (review finding 1)', () => {
  for (const s of ['0.021', '.021', '2.1e-2', '2.1×10^-2', '2.1 x 10^(-2)', '2.1 × 10⁻²']) near(PC.parseAnswer(s), 0.021, 1e-12);
  for (const [s, v] of [['12,000', 12000], ['12 000', 12000], ['1,234,567.5', 1234567.5], ['−3.5', -3.5], ['7.35 m', 7.35],
    ['7.35 เมตร', 7.35], ['300 W/m2', 300], ['71.6°', 71.6], ['56%', 56]])
    assert.equal(PC.parseAnswer(s), v, s);
  for (const s of ['2.4 x 10-13', '71.6°5']) assert.equal(PC.parseAnswer(s), null, s);
});

test('check tolerance', () => {
  assert.equal(PC.checkNumeric(7.49, 7.35).ok, true);
  assert.equal(PC.checkNumeric(7.6, 7.35).ok, false);
  assert.deepEqual(PC.checkNumeric(14.7, 7.35, 0.02, [{ value: 14.7, msg: 'ลืมหาร 2' }]), { ok: false, msg: 'ลืมหาร 2' });
  assert.equal(PC.checkNumeric(-7.4, -7.35).ok, true);
  assert.equal(PC.checkNumeric(-7.6, -7.35).ok, false);
});

test('classify rules', () => {
  assert.equal(PC.classify({ correct: true, tries: 1 }), 'ok');
  assert.equal(PC.classify({ correct: true, tries: 2 }), 'ok');
  assert.equal(PC.classify({ correct: true, tries: 3 }), 'ok-help');
  assert.equal(PC.classify({ correct: true, usedHint: true, tries: 1 }), 'ok-help');
  assert.equal(PC.classify({ correct: true, sawSolution: true }), 'wrong');
  assert.equal(PC.classify({ correct: false, skipped: true }), 'wrong');
  assert.equal(PC.classify({ correct: false, tries: 1, type: 'mcq' }), 'wrong');
});

const mk = n => Array.from({ length: n }, (_, i) => ({ id: `mech-1-${i + 1}`, level: 1 }));

test('summary and pass', () => {
  const items = mk(7);
  const rec = k => ({ v: 1, items: Object.fromEntries(items.slice(0, k).map(it => [it.id, { s: 'ok' }])) });
  assert.equal(PC.summarize(items, rec(5))[0].passed, true);
  assert.equal(PC.summarize(items, rec(4))[0].passed, false);
  const s = PC.summarize(items, rec(5))[0];
  assert.deepEqual([s.total, s.ok, s.okHelp, s.wrong, s.todo], [7, 5, 0, 0, 2]);
});

test('summary ignores unknown ids', () => {
  const s = PC.summarize(mk(3), { v: 1, items: { 'mech-9-99': { s: 'ok' } } });
  assert.equal(s.length, 3);
  assert.equal(s[0].ok, 0); assert.equal(s[0].todo, 3);
});

test('recommend', () => {
  const items = [1, 2, 3].flatMap(l => [1, 2].map(i => ({ id: `m-${l}-${i}`, level: l })));
  const all = s => ({ v: 1, items: Object.fromEntries(items.map(it => [it.id, { s }])) });
  let rec = all('ok');
  assert.deepEqual(PC.recommend(PC.summarize(items, rec), rec, items), { kind: 'next' });
  rec.items['m-2-1'] = { s: 'wrong' };
  rec.items['m-2-2'] = { s: 'ok' };
  // L2 is 1/2 = 50% -> unpassed, so level recommended
  assert.deepEqual(PC.recommend(PC.summarize(items, rec), rec, items), { kind: 'level', level: 2 });
  // all passed but one wrong: 3 levels of 2 items need >=70% -> make level big enough
  const big = [1, 2, 3].flatMap(l => Array.from({ length: 10 }, (_, i) => ({ id: `b-${l}-${i}`, level: l })));
  const r2 = { v: 1, items: Object.fromEntries(big.map(it => [it.id, { s: 'ok' }])) };
  r2.items['b-1-0'] = { s: 'wrong' };
  assert.deepEqual(PC.recommend(PC.summarize(big, r2), r2, big), { kind: 'redo', count: 1 });
  assert.deepEqual(PC.recommend(PC.summarize(big, { v: 1, items: {} }), { v: 1, items: {} }, big), { kind: 'level', level: 1 });
});

test('fmt', () => {
  assert.equal(PC.fmt(7.3469), '7.35');
  assert.equal(PC.fmt(12000), '12000');
  const s = PC.fmt(0.000021);
  assert.ok(s.includes('2.10') && s.includes('10^{-5}'), s);
  for (const x of [7.3469, 0.0123, 4567.8, 99.94]) near(PC.parseAnswer(PC.fmt(x)) / x, 1, 0.005);
});

test('readRecord', () => {
  for (const raw of [null, 'x', { bad: 1 }, { v: 2, items: {} }]) assert.deepEqual(PC.readRecord(raw), { v: 1, items: {} });
  const good = { v: 1, items: { a: { s: 'ok', n: 1, t: 5 } } };
  assert.deepEqual(PC.readRecord(good), good);
});

test('instantiate', () => {
  const item = {
    id: 'mech-2-1', level: 2, type: 'numeric', unit: 'm',
    gen: rng => ({ h: PC.pick(rng, 5, 20, 0.5) }),
    q: v => `h = ${v.h}`, answer: v => v.h * 2,
    hints: v => ['h' + v.h], solution: v => `ans ${v.h * 2}`
  };
  const a = PC.instantiate(item, PC.makeRng(5)), b = PC.instantiate(item, PC.makeRng(5));
  assert.equal(a.q, b.q); assert.equal(a.answer, b.answer);
  assert.equal(a.tol, 0.02); assert.deepEqual(a.mistakes, []); assert.equal(a.inputMode, 'decimal');
  const fixed = PC.instantiate({ id: 'x', level: 3, type: 'numeric', q: 'fixed', answer: 3 }, PC.makeRng(1));
  assert.equal(fixed.vars, null); assert.equal(fixed.q, 'fixed');
  for (const [ans, mode] of [[-2, 'text'], [0.0005, 'text'], [1e5, 'text'], [2.5, 'decimal']]) {
    assert.equal(PC.instantiate({ id: 'y', level: 3, type: 'numeric', answer: ans }, PC.makeRng(1)).inputMode, mode);
  }
});

test('instantiate resolves per-element hints and mistake values', () => {
  const item = {
    id: 'mech-2-02', level: 2, type: 'num', unit: 'm',
    gen: () => ({ h: 4 }), q: v => `h = ${v.h}`, answer: v => v.h * 2,
    hints: ['plain', v => 'h is ' + v.h],
    mistakes: [{ value: v => v.h * 4, msg: 'twice' }, { value: 1, msg: 'fixed' }]
  };
  const x = PC.instantiate(item, PC.makeRng(1));
  assert.deepEqual(x.hints, ['plain', 'h is 4']);
  assert.deepEqual(x.mistakes, [{ value: 16, msg: 'twice' }, { value: 1, msg: 'fixed' }]);
  assert.deepEqual(PC.checkNumeric(16, x.answer, x.tol, x.mistakes), { ok: false, msg: 'twice' });
  assert.equal(typeof item.mistakes[0].value, 'function', 'item itself is not mutated');
});
