/* Circuit — pure DC-circuit maths for the circuits chapter. SI units (V, A, Ohm, F, s).
 * build(scene, p) gives the topology; solve(scene, p) solves it by modified nodal analysis.
 * Current is conventional (positive charge direction): elems[id].I is positive from node a to node b,
 * V = v[a] - v[b]. A battery (emf) has a = negative pole, b = positive pole; its internal resistance is a
 * separate 'res' element. A capacitor is modelled in solve() as a voltage source of its voltage vC
 * (0 V = empty); time evolution is rcState() only.
 * Works as a browser classic script (global Circuit) and in Node (module.exports). */
var Circuit = (function () {
  var SCENES = ['single', 'series', 'parallel', 'mixed', 'twoloop', 'rc'];
  var R_INTERNAL_MIN = 0.05;

  function defaults(sceneId) {
    var p = { eps: 12, r: 0.5, R1: 2, R2: 4, R3: 6, eps2: 6, C: 1e-3 };
    if (sceneId === 'parallel') { p.R1 = 6; p.R2 = 3; p.R3 = 2; }
    if (sceneId === 'mixed') { p.R1 = 4; p.R2 = 6; p.R3 = 3; }
    if (sceneId === 'twoloop') { p.eps2 = 12; p.R1 = 2; p.R2 = 2; p.R3 = 4; }
    return p;
  }

  function build(sceneId, p) {
    var el = [];
    function add(id, kind, a, b, value) { el.push({ id: id, kind: kind, a: a, b: b, value: value }); }
    var nodes;
    if (sceneId === 'twoloop') {
      // top node 1, bottom (ground) node 0
      add('eps', 'emf', 0, 2, p.eps); add('r', 'res', 2, 3, p.r); add('R1', 'res', 3, 1, p.R1);
      add('R3', 'res', 1, 0, p.R3);
      add('eps2', 'emf', 0, 4, p.eps2); add('r2', 'res', 4, 5, p.r); add('R2', 'res', 5, 1, p.R2);
      nodes = 6;
    } else {
      add('eps', 'emf', 0, 1, p.eps); add('r', 'res', 1, 2, p.r);
      if (sceneId === 'single') { add('R1', 'res', 2, 0, p.R1); nodes = 3; }
      else if (sceneId === 'series') { add('R1', 'res', 2, 3, p.R1); add('R2', 'res', 3, 4, p.R2); add('R3', 'res', 4, 0, p.R3); nodes = 5; }
      else if (sceneId === 'parallel') { add('R1', 'res', 2, 0, p.R1); add('R2', 'res', 2, 0, p.R2); add('R3', 'res', 2, 0, p.R3); nodes = 3; }
      else if (sceneId === 'mixed') { add('R1', 'res', 2, 3, p.R1); add('R2', 'res', 3, 0, p.R2); add('R3', 'res', 3, 0, p.R3); nodes = 4; }
      else if (sceneId === 'rc') { add('R1', 'res', 2, 3, p.R1); add('C', 'cap', 3, 0, p.C); nodes = 4; }
      else throw new Error('unknown scene ' + sceneId);
    }
    return { nodes: nodes, ground: 0, elems: el };
  }

  // Gaussian elimination with partial pivoting; A is n x n (rows are arrays), b length n.
  function gauss(A, b) {
    var n = b.length, i, j, k;
    for (i = 0; i < n; i++) {
      var piv = i;
      for (j = i + 1; j < n; j++) if (Math.abs(A[j][i]) > Math.abs(A[piv][i])) piv = j;
      var t = A[i]; A[i] = A[piv]; A[piv] = t;
      var tb = b[i]; b[i] = b[piv]; b[piv] = tb;
      for (j = i + 1; j < n; j++) {
        var f = A[j][i] / A[i][i];
        if (f === 0) continue;
        for (k = i; k < n; k++) A[j][k] -= f * A[i][k];
        b[j] -= f * b[i];
      }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) {
      var s = b[i];
      for (k = i + 1; k < n; k++) s -= A[i][k] * x[k];
      x[i] = s / A[i][i];
    }
    return x;
  }

  function externalR(sceneId, p) {
    if (sceneId === 'series') return p.R1 + p.R2 + p.R3 + p.r; // brief: series total includes r (other scenes exclude it)
    if (sceneId === 'parallel') return 1 / (1 / p.R1 + 1 / p.R2 + 1 / p.R3);
    if (sceneId === 'mixed') return p.R1 + p.R2 * p.R3 / (p.R2 + p.R3);
    if (sceneId === 'twoloop') return null; // no single equivalent resistance with two sources
    return p.R1; // single, rc
  }

  function solve(sceneId, p) {
    var net = build(sceneId, p);
    var n = net.nodes - 1;                 // unknown potentials: nodes 1..nodes-1
    var srcs = net.elems.filter(function (e) { return e.kind !== 'res'; });
    var N = n + srcs.length;
    var A = [], b = [], i, k;
    for (i = 0; i < N; i++) { A.push(new Array(N).fill(0)); b.push(0); }
    // node row index = node - 1 (ground dropped); source current unknown at n + index
    net.elems.forEach(function (e) {
      var ra = e.a - 1, rb = e.b - 1;
      if (e.kind === 'res') {
        var g = 1 / e.value;
        if (ra >= 0) { A[ra][ra] += g; if (rb >= 0) A[ra][rb] -= g; }
        if (rb >= 0) { A[rb][rb] += g; if (ra >= 0) A[rb][ra] -= g; }
      }
    });
    srcs.forEach(function (e, s) {
      var ra = e.a - 1, rb = e.b - 1, col = n + s;
      var E = e.value;
      if (ra >= 0) A[ra][col] += 1;
      if (rb >= 0) A[rb][col] -= 1;
      // constraint row: emf: v[b] - v[a] = eps ; cap: v[a] - v[b] = vC = 0
      if (e.kind === 'emf') { if (rb >= 0) A[col][rb] += 1; if (ra >= 0) A[col][ra] -= 1; b[col] = E; }
      else { if (ra >= 0) A[col][ra] += 1; if (rb >= 0) A[col][rb] -= 1; b[col] = 0; }
    });
    var x = gauss(A, b);
    var v = [0];
    for (i = 0; i < n; i++) v.push(x[i]);
    var elems = {};
    net.elems.forEach(function (e) {
      var V = v[e.a] - v[e.b], I, P;
      if (e.kind === 'res') { I = V / e.value; P = I * I * e.value; }
      else { I = x[n + srcs.indexOf(e)]; P = e.kind === 'emf' ? e.value * I : V * I; }
      elems[e.id] = { I: I, V: V, P: P };
    });
    var Itotal = elems.eps.I + (elems.eps2 ? elems.eps2.I : 0);
    var Ptotal = elems.eps.P + (elems.eps2 ? elems.eps2.P : 0);
    return { v: v, elems: elems, Rtotal: externalR(sceneId, p), Itotal: Itotal,
      Vterm: p.eps - elems.eps.I * p.r, Ptotal: Ptotal };
  }

  function tau(p, mode) { return (mode === 'discharge' ? p.R1 : p.R1 + p.r) * p.C; }

  function rcState(p, mode, t, v0) {
    var tc = tau(p, mode), q, vC, i;
    if (mode === 'discharge') {
      var start = v0 === undefined ? p.eps : v0;
      q = p.C * start * Math.exp(-t / tc);
      vC = q / p.C; i = -vC / p.R1;
    } else {
      q = p.C * p.eps * (1 - Math.exp(-t / tc));
      vC = q / p.C; i = (p.eps - vC) / (p.R1 + p.r);
    }
    return { q: q, vC: vC, i: i };
  }

  return { SCENES: SCENES, R_INTERNAL_MIN: R_INTERNAL_MIN, defaults: defaults, build: build, solve: solve, tau: tau, rcState: rcState };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Circuit;
