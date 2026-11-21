const test = require('node:test');
const assert = require('node:assert/strict');
const EField = require('../assets/js/sims/efield-core.js');

const rel = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${a} !~ ${b}`);

test('point charge E', () => {
  const E = EField.field([{ x: 0, y: 0, z: 0, q: 1 }], { x: 10, y: 0, z: 0 });
  rel(E.mag, 9.0e5, 1e-3);
  rel(E.x, 9.0e5, 1e-3);
  assert.ok(Math.abs(E.y) < 1e-6 && Math.abs(E.z) < 1e-6);
});

test('point charge V', () => {
  rel(EField.potential([{ x: 0, y: 0, z: 0, q: 1 }], { x: 10, y: 0, z: 0 }), 9.0e4, 1e-3);
});

test('superposition zero', () => {
  const single = EField.field([{ x: -5, y: 0, z: 0, q: 1 }], { x: 0, y: 0, z: 0 }).mag;
  const both = EField.field([{ x: -5, y: 0, z: 0, q: 1 }, { x: 5, y: 0, z: 0, q: 1 }], { x: 0, y: 0, z: 0 }).mag;
  assert.ok(both < 1e-6 * single);
});

test('E = -grad V', () => {
  const cs = [{ x: -4, y: 0, z: 0, q: 2 }, { x: 4, y: 0, z: 0, q: -2 }];
  let s = 12345;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const h = 0.01;
  for (let i = 0; i < 5; i++) {
    const p = { x: rnd() * 20 - 10, y: rnd() * 20 - 10, z: rnd() * 20 - 10 };
    const E = EField.field(cs, p);
    const d = (ax) => {
      const a = { x: p.x, y: p.y, z: p.z }, b = { x: p.x, y: p.y, z: p.z };
      a[ax] += h; b[ax] -= h;
      return -(EField.potential(cs, a) - EField.potential(cs, b)) / (2 * h * 0.01);
    };
    const g = { x: d('x'), y: d('y'), z: d('z') };
    const err = Math.hypot(g.x - E.x, g.y - E.y, g.z - E.z);
    assert.ok(err <= 0.01 * E.mag, `err ${err} vs ${E.mag}`);
  }
});

test('field at a charge is finite', () => {
  const cs = [{ x: 1, y: 2, z: 3, q: 1 }];
  const E = EField.field(cs, { x: 1, y: 2, z: 3 });
  assert.ok(Number.isFinite(E.mag) && Number.isFinite(E.x));
  assert.ok(Number.isFinite(EField.potential(cs, { x: 1, y: 2, z: 3 })));
});

test('dipole lines start at + and end at -', () => {
  const cs = [{ x: -4, y: 0, z: 0, q: 2 }, { x: 4, y: 0, z: 0, q: -2 }];
  const all = EField.traceLines(cs, {});
  assert.ok(all.length > 0);
  // lines from the negative are only the owed ones from infinity (to = -1)
  for (const l of all) if (l.from === 1) assert.equal(l.to, -1);
  const lines = all.filter((l) => l.from === 0);
  let ended = 0;
  for (const l of all) {
    if (l.to === 1 && l.from === 0) ended++;
    for (let i = 0; i < l.points.length; i++) assert.ok(Number.isFinite(l.points[i]));
  }
  assert.ok(ended >= 0.8 * lines.length, `${ended}/${lines.length}`);
});

test('trace with only negatives', () => {
  const c = { x: 1, y: 0, z: 0, q: -1 };
  const lines = EField.traceLines([c], {});
  assert.ok(lines.length > 0);
  for (const l of lines) {
    let prev = -1;
    for (let i = 0; i < l.points.length; i += 3) {
      assert.ok(Number.isFinite(l.points[i]) && Number.isFinite(l.points[i + 1]) && Number.isFinite(l.points[i + 2]));
      const d = Math.hypot(l.points[i] - c.x, l.points[i + 1] - c.y, l.points[i + 2] - c.z);
      assert.ok(d > prev - 1e-4, 'distance must increase');
      prev = d;
    }
  }
});

test('line count proportional to |q|', () => {
  const a = EField.traceLines([{ x: 0, y: 0, z: 0, q: 1 }], {}).length;
  const b = EField.traceLines([{ x: 0, y: 0, z: 0, q: 3 }], {}).length;
  assert.ok(Math.abs(b - 3 * a) <= 1, `${a} ${b}`);
});

test('no charges', () => {
  assert.deepEqual(EField.traceLines([], {}), []);
});

test('isWithin', () => {
  const cs = [{ x: 0, y: 0, z: 0, q: 1 }];
  assert.equal(EField.isWithin({ x: 1, y: 0, z: 0 }, cs, 2), true);
  assert.equal(EField.isWithin({ x: 3, y: 0, z: 0 }, cs, 2), false);
});

test('lines density at a stronger negative is proportional to |q|', () => {
  const cs = [{ x: -4, y: 0, z: 0, q: 1 }, { x: 4, y: 0, z: 0, q: -3 }];
  const lines = EField.traceLines(cs, {});
  const plus = lines.filter((l) => l.from === 0).length;
  const touching = lines.filter((l) => l.to === 1 || l.from === 1).length;
  assert.ok(Math.abs(touching - 3 * plus) <= 1, `${touching} vs 3*${plus}`);
  for (const l of lines) for (let i = 0; i < l.points.length; i++) assert.ok(Number.isFinite(l.points[i]));
});

test('pure dipole gains no duplicate lines', () => {
  const cs = [{ x: -4, y: 0, z: 0, q: 1 }, { x: 4, y: 0, z: 0, q: -1 }];
  const lines = EField.traceLines(cs, {});
  assert.equal(lines.filter((l) => l.from === 0).length, 8);
  const touching = lines.filter((l) => l.to === 1 || l.from === 1).length;
  assert.ok(Math.abs(touching - 8) <= 1, `${touching}`);
  // extra lines from the negative must come from infinity, never retrace a + line
  for (const l of lines) if (l.from === 1) assert.equal(l.to, -1);
});

test('no degenerate lines', () => {
  const sets = [
    [{ x: 0, y: 0, z: 0, q: 1 }, { x: 0, y: 0, z: 0, q: -1 }],
    [{ x: 100, y: 0, z: 0, q: 1 }],
    [{ x: 0, y: 0, z: 0, q: 1 }, { x: 5, y: 0, z: 0, q: -1 }]
  ];
  for (const cs of sets) for (const l of EField.traceLines(cs, {})) assert.ok(l.points.length >= 6);
});

test('tiny charge still gets a line', () => {
  assert.ok(EField.traceLines([{ x: 0, y: 0, z: 0, q: 0.05 }], {}).length >= 1);
});

test('fieldInto equals field', () => {
  const cs = [{ x: -4, y: 1, z: 0, q: 2 }, { x: 4, y: 0, z: 2, q: -1 }];
  const p = { x: 1, y: 2, z: 3 }, out = [0, 0, 0];
  const E = EField.field(cs, p);
  const m = EField.fieldInto(cs, p.x, p.y, p.z, out);
  assert.equal(m, E.mag); assert.equal(out[0], E.x); assert.equal(out[1], E.y); assert.equal(out[2], E.z);
});
