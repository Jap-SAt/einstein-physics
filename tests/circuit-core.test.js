const test = require('node:test');
const assert = require('node:assert/strict');
const Circuit = require('../assets/js/sims/circuit-core.js');

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} !~ ${b}`);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('series total', () => {
  const s = Circuit.solve('series', { eps: 12, r: 0.5, R1: 2, R2: 4, R3: 6, C: 1e-3 });
  near(s.Rtotal, 12);
  near(s.Itotal, 0.96);
  ['R1', 'R2', 'R3'].forEach((id, k) => {
    near(s.elems[id].I, 0.96);
    near(s.elems[id].V, 0.96 * [2, 4, 6][k]);
  });
  near(s.Vterm, 12 - 0.96 * 0.5);
});

test('parallel total', () => {
  const s = Circuit.solve('parallel', { eps: 12, r: 0.5, R1: 6, R2: 3, R3: 2, C: 1e-3 });
  near(s.Rtotal, 1);
  near(s.Itotal, 8);
  ['R1', 'R2', 'R3'].forEach(id => near(s.elems[id].V, 8));
  near(s.elems.R1.I, 4 / 3);
  near(s.elems.R2.I, 8 / 3);
  near(s.elems.R3.I, 4);
});

test('mixed', () => {
  const s = Circuit.solve('mixed', { eps: 12, r: 0.5, R1: 4, R2: 6, R3: 3, C: 1e-3 });
  near(s.Rtotal, 6);
  near(s.Itotal, 12 / 6.5);
  near(s.elems.R3.I, 2 * s.elems.R2.I);
  near(s.elems.R2.I + s.elems.R3.I, s.elems.R1.I);
});

function randomParams(rnd) {
  const u = (lo, hi) => lo + (hi - lo) * rnd();
  return { eps: u(1, 24), r: u(Circuit.R_INTERNAL_MIN, 2), R1: u(0.5, 100), R2: u(0.5, 100), R3: u(0.5, 100), eps2: u(1, 24), C: 1e-3 };
}

function paramSets(scene) {
  const rnd = mulberry32(12345);
  const out = [Circuit.defaults(scene)];
  for (let i = 0; i < 20; i++) out.push(randomParams(rnd));
  return out;
}

test('KCL and KVL hold in every scene', () => {
  Circuit.SCENES.filter(s => s !== 'rc').forEach(scene => {
    paramSets(scene).forEach(p => {
      const net = Circuit.build(scene, p);
      const sol = Circuit.solve(scene, p);
      const scale = Math.max(1, ...net.elems.map(e => Math.abs(sol.elems[e.id].I)));
      // KCL: sum of currents leaving each node
      for (let n = 0; n < net.nodes; n++) {
        let sum = 0;
        net.elems.forEach(e => {
          if (e.a === n) sum += sol.elems[e.id].I;
          if (e.b === n) sum -= sol.elems[e.id].I;
        });
        assert.ok(Math.abs(sum) < 1e-9 * scale, `${scene} node ${n}: ${sum}`);
      }
      // constitutive relations
      net.elems.forEach(e => {
        const r = sol.elems[e.id];
        if (e.kind === 'res') assert.ok(Math.abs(r.V - r.I * e.value) < 1e-9 * Math.max(1, Math.abs(r.V)), `${scene} ${e.id} V=IR`);
      });
      [['eps', 'r'], ['eps2', 'r2']].forEach(([em, rr]) => {
        const emf = net.elems.find(e => e.id === em);
        if (!emf) return;
        const rEl = net.elems.find(e => e.id === rr);
        const I = sol.elems[em].I;
        near(sol.elems[rr].I, I);
        // terminal voltage: from the battery's far terminal side of r back to its negative pole = emf - I*r
        const vt = sol.v[rEl.b] - sol.v[emf.a];
        assert.ok(Math.abs(vt - (emf.value - I * rEl.value)) < 1e-9 * Math.max(1, Math.abs(emf.value)), `${scene} ${em} terminal`);
      });
    });
  });
});

test('power balance', () => {
  Circuit.SCENES.filter(s => s !== 'rc').forEach(scene => {
    paramSets(scene).forEach(p => {
      const net = Circuit.build(scene, p);
      const sol = Circuit.solve(scene, p);
      let dissipated = 0, supplied = 0;
      net.elems.forEach(e => {
        if (e.kind === 'res') dissipated += sol.elems[e.id].P;
        if (e.kind === 'emf') supplied += e.value * sol.elems[e.id].I;
      });
      assert.ok(Math.abs(dissipated - supplied) < 1e-9 * Math.max(1, supplied), `${scene}: ${dissipated} vs ${supplied}`);
      if (scene !== 'twoloop') near(supplied, p.eps * sol.Itotal);
      near(sol.Ptotal, supplied);
    });
  });
});

test('terminal voltage', () => {
  Circuit.SCENES.filter(s => s !== 'rc').forEach(scene => {
    paramSets(scene).forEach(p => {
      const sol = Circuit.solve(scene, p);
      near(sol.Vterm, p.eps - sol.elems.eps.I * p.r);
    });
  });
});

test('twoloop symmetric', () => {
  const s = Circuit.solve('twoloop', { eps: 12, eps2: 12, r: 0.5, R1: 2, R2: 2, R3: 4, C: 1e-3 });
  near(s.elems.R1.I, 12 / 10.5);
  near(s.elems.R2.I, 12 / 10.5);
  near(s.elems.R3.I, 2 * 12 / 10.5);
});

test('twoloop sign', () => {
  const p = { eps: 12, eps2: 3, r: 0.5, R1: 2, R2: 2, R3: 4, C: 1e-3 };
  const net = Circuit.build('twoloop', p);
  const s = Circuit.solve('twoloop', p);
  assert.ok(s.elems.eps2.I < 0);
  assert.ok(s.elems.eps.I > 0);
  for (let n = 0; n < net.nodes; n++) {
    let sum = 0;
    net.elems.forEach(e => { if (e.a === n) sum += s.elems[e.id].I; if (e.b === n) sum -= s.elems[e.id].I; });
    assert.ok(Math.abs(sum) < 1e-9);
  }
});

test('rc', () => {
  const p = { eps: 12, r: 0.5, R1: 2, C: 1e-3 };
  const tau = Circuit.tau(p, 'charge');
  near(tau, 2.5e-3);
  near(Circuit.tau(p, 'discharge'), 2e-3);
  const ch = Circuit.rcState(p, 'charge', tau);
  near(ch.q / (p.C * p.eps), 1 - Math.exp(-1));
  const dis = Circuit.rcState(p, 'discharge', Circuit.tau(p, 'discharge'), 9);
  near(dis.q / (p.C * 9), Math.exp(-1));
  const z = Circuit.rcState(p, 'charge', 0);
  assert.equal(z.q, 0);
  near(z.i, 12 / 2.5);
  const end = Circuit.rcState(p, 'charge', 20 * tau);
  near(end.q, p.C * p.eps, 1e-8);
  assert.ok(Math.abs(end.i) < 1e-8);
  const d0 = Circuit.rcState(p, 'discharge', 0);
  near(d0.i, -12 / 2);
  // solve('rc') is the empty-capacitor state at t = 0
  near(Circuit.solve('rc', p).Itotal, 12 / 2.5);
});

test('extreme values stay finite', () => {
  ['parallel', 'mixed', 'series', 'twoloop'].forEach(scene => {
    [{ R1: 1e-3, R2: 1e6, R3: 1e6 }, { R1: 1e6, R2: 1e-3, R3: 1e-3 }].forEach(q => {
      const p = Object.assign({ eps: 12, eps2: 6, r: Circuit.R_INTERNAL_MIN, C: 1e-3 }, q);
      const s = Circuit.solve(scene, p);
      [s.Rtotal, s.Itotal, s.Vterm, s.Ptotal].forEach(x => { if (x !== null) assert.ok(Number.isFinite(x), `${scene}`); });
      s.v.forEach(x => assert.ok(Number.isFinite(x)));
      Object.values(s.elems).forEach(e => [e.I, e.V, e.P].forEach(x => assert.ok(Number.isFinite(x))));
    });
  });
});
