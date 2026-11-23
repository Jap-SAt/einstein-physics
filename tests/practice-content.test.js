// Validator for every practice data file assets/js/data/practice/<id>.js. Run: node --test tests/
// Each chapter must pass the same checks; later chapters only add a data file + reference JSON.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'assets/js/data/practice');
const REF_DIR = path.join(__dirname, 'practice-ref');
const CORE_SRC = fs.readFileSync(path.join(ROOT, 'assets/js/practice/practice-core.js'), 'utf8');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const DRAWS = 500;
const SOLUTION_SEEDS = [1, 2, 3];
const REF_TOL = 0.005;
const THAI_IN_TEXT = /\\text\{[^}]*[฀-๿]/;
const BAD_TEXT = /undefined|NaN/;

const chapters = fs.existsSync(DATA_DIR)
  ? fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3)).sort()
  : [];

function load(id) {
  const ctx = vm.createContext({ console });
  vm.runInContext(CORE_SRC, ctx, { filename: 'practice-core.js' });
  vm.runInContext(fs.readFileSync(path.join(DATA_DIR, id + '.js'), 'utf8'), ctx, { filename: id + '.js' });
  return { items: ctx.PRACTICE[id], PC: ctx.PracticeCore };
}

function lectureTopics(id) {
  const m = new RegExp(`<template id="lec-${id}">([\\s\\S]*?)</template>`).exec(INDEX);
  if (!m) return null;
  return [...m[1].matchAll(/<h2 id="([^"]+)"/g)].map(x => x[1]);
}

const relDiff = (x, ref) => Math.abs(x - ref) / Math.abs(ref);
const str = (v, vars) => (typeof v === 'function' ? v(vars) : v);

// Typing a mistake's value must show that mistake's own message (not an earlier one that collides).
function assertDiagnosis(PC, mk, answer, tol, mistakes, tag) {
  const shown = PC.checkNumeric(mk.value, answer, tol, mistakes).msg;
  assert.equal(shown, mk.msg, `${tag}: typing ${mk.value} shows another mistake's message`);
}

function itemTexts(it, vars) {
  const out = [];
  if (it.level === 1) {
    out.push(it.q, it.e);
    it.options.forEach(o => out.push(o.t, o.why));
  } else {
    out.push(str(it.q, vars), str(it.solution, vars));
    (it.hints || []).forEach(h => out.push(str(h, vars)));
    (it.mistakes || []).forEach(mk => out.push(mk.msg));
  }
  return out;
}

// MathJax delimiters must pair up and never nest: "\( a \( b \) \)" breaks rendering. This happens when
// PracticeCore.fmt(x) (which wraps |x| >= 1e5 in \(...\)) is interpolated inside a math span.
// Returns null when fine, otherwise a short description of the first problem.
function mathSpanProblem(s) {
  const CLOSE = { '(': ')', '[': ']' };
  let open = null;
  for (let i = 0; i < s.length - 1; i++) {
    if (s[i] !== '\\') continue;
    const c = s[i + 1];
    if (c === '\\') { i++; continue; }               // TeX "\\" (line break), not a delimiter
    if (c === '(' || c === '[') {
      if (open) return `\\${c} opened inside \\${open} at ${i}`;
      open = c; i++;
    } else if (c === ')' || c === ']') {
      if (!open) return `\\${c} without an open span at ${i}`;
      if (CLOSE[open] !== c) return `\\${open} closed by \\${c} at ${i}`;
      open = null; i++;
    }
  }
  return open ? `\\${open} never closed` : null;
}

test('math span checker flags nested and unbalanced spans', () => {
  for (const ok of ['', 'no math', String.raw`\(a\) and \(b = \dfrac{1}{2}\)`, String.raw`\[x\] then \(y \\ z\)`])
    assert.equal(mathSpanProblem(ok), null, ok);
  for (const bad of [String.raw`\(Q = \(1.5 \times 10^{5}\)\ \text{J}\)`, String.raw`\(a`, String.raw`b\)`,
    String.raw`\(a\]`, String.raw`\[a \(b\) \]`])
    assert.notEqual(mathSpanProblem(bad), null, bad);
});

test('at least one chapter has practice data', () => {
  assert.ok(chapters.length >= 1, `no files in ${DATA_DIR}`);
});

for (const id of chapters) {
  const { items, PC } = load(id);
  const L = lv => (items || []).filter(it => it.level === lv);
  const ref = (() => {
    const p = path.join(REF_DIR, id + '.json');
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  })();

  test(`${id}: index.html loads practice-core and this data file`, () => {
    const core = INDEX.indexOf('src="assets/js/practice/practice-core.js"');
    const data = INDEX.indexOf(`src="assets/js/data/practice/${id}.js"`);
    assert.ok(core > 0, 'practice-core.js script tag missing');
    assert.ok(data > core, `data/practice/${id}.js script tag missing or before practice-core.js`);
  });

  test(`${id}: counts`, () => {
    assert.ok(Array.isArray(items), `PRACTICE.${id} is not an array`);
    assert.equal(items.length, 20, 'item count');
    assert.deepEqual([L(1).length, L(2).length, L(3).length], [7, 7, 6], 'levels 7/7/6');
    const ids = items.map(it => it.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate ids');
    const re = new RegExp(`^${id}-[123]-\\d\\d$`);
    for (const it of items) {
      assert.match(it.id, re);
      assert.equal(Number(it.id.split('-')[1]), it.level, `${it.id}: id level != level`);
      assert.equal(it.type, it.level === 1 ? 'mcq' : 'num', `${it.id}: type`);
      if (it.level > 1) assert.ok(typeof it.unit === 'string' && it.unit.length > 0, `${it.id}: unit`);
    }
  });

  test(`${id}: coverage`, () => {
    const topics = lectureTopics(id);
    assert.ok(topics && topics.length > 0, `no <h2 id> in <template id="lec-${id}">`);
    for (const it of [...L(1), ...L(2)]) assert.ok(topics.includes(it.topic), `${it.id}: topic ${it.topic}`);
    const touched = new Set([...L(1), ...L(2)].map(it => it.topic));
    for (const t of topics) assert.ok(touched.has(t), `section ${t} has no L1/L2 item`);
    for (const it of L(3)) {
      assert.ok(Array.isArray(it.topics), `${it.id}: topics`);
      assert.ok(new Set(it.topics).size >= 2, `${it.id}: needs >= 2 distinct topics`);
      for (const t of it.topics) assert.ok(topics.includes(t), `${it.id}: topic ${t}`);
    }
  });

  test(`${id}: mcq`, () => {
    for (const it of L(1)) {
      assert.equal(it.options.length, 4, `${it.id}: 4 options`);
      assert.equal(new Set(it.options.map(o => o.t)).size, 4, `${it.id}: distinct options`);
      assert.ok(Number.isInteger(it.a) && it.a >= 0 && it.a < 4, `${it.id}: a`);
      assert.ok(typeof it.q === 'string' && it.q.trim(), `${it.id}: q`);
      assert.ok(typeof it.e === 'string' && it.e.trim(), `${it.id}: e`);
      it.options.forEach((o, i) => {
        assert.ok(typeof o.t === 'string' && o.t.trim(), `${it.id}: option ${i} text`);
        if (i === it.a) assert.equal(o.why, '', `${it.id}: right option why should be ''`);
        else assert.ok(typeof o.why === 'string' && o.why.trim(), `${it.id}: option ${i} why`);
      });
    }
  });

  test(`${id}: L2 randomized`, () => {
    for (const it of L(2)) {
      assert.equal(typeof it.gen, 'function', `${it.id}: gen`);
      assert.ok(Array.isArray(it.range) && it.range[0] < it.range[1], `${it.id}: range`);
      const tol = it.tol == null ? 0.02 : it.tol;
      const rng = PC.makeRng(1234);
      for (let i = 0; i < DRAWS; i++) {
        const vars = it.gen(rng);
        const a = it.answer(vars);
        const tag = `${it.id} vars=${JSON.stringify(vars)}`;
        assert.ok(Number.isFinite(a) && a !== 0, `${tag}: answer ${a}`);
        assert.ok(a >= it.range[0] && a <= it.range[1], `${tag}: answer ${a} outside range`);
        const q = it.q(vars), sol = it.solution(vars);
        assert.doesNotMatch(q, BAD_TEXT, `${tag}: q`);
        assert.doesNotMatch(sol, BAD_TEXT, `${tag}: solution`);
        for (const h of it.hints) assert.doesNotMatch(str(h, vars), BAD_TEXT, `${tag}: hint`);
        const resolved = it.mistakes.map(mk => ({ value: mk.value(vars), msg: mk.msg }));
        for (const mk of resolved) {
          assert.ok(Number.isFinite(mk.value), `${tag}: mistake not finite`);
          assert.ok(relDiff(mk.value, a) > 2 * tol, `${tag}: mistake ${mk.value} too close to ${a} (${mk.msg})`);
          assertDiagnosis(PC, mk, a, tol, resolved, tag);
        }
      }
    }
  });

  test(`${id}: solution matches answer`, () => {
    for (const it of L(2)) {
      for (const seed of SOLUTION_SEEDS) {
        const vars = it.gen(PC.makeRng(seed));
        const want = PC.fmt(it.answer(vars));
        assert.ok(it.solution(vars).includes(want), `${it.id} seed ${seed}: solution lacks ${want}`);
      }
    }
    // L3 may state its answer to 3 or 4 significant figures (e.g. 10980 rather than 11000)
    for (const it of L(3)) {
      const want = [PC.fmt(it.answer), PC.fmt(it.answer, 4)];
      assert.ok(want.some(w => it.solution.includes(w)), `${it.id}: solution lacks ${want.join(' / ')}`);
    }
  });

  test(`${id}: instantiate yields plain strings and numbers`, () => {
    for (const it of [...L(2), ...L(3)]) {
      const x = PC.instantiate(it, PC.makeRng(7));
      assert.ok(typeof x.q === 'string' && typeof x.solution === 'string', `${it.id}: q/solution`);
      assert.ok(Number.isFinite(x.answer), `${it.id}: answer`);
      for (const h of x.hints) assert.equal(typeof h, 'string', `${it.id}: hint`);
      for (const mk of x.mistakes) assert.ok(Number.isFinite(mk.value) && typeof mk.msg === 'string', `${it.id}: mistake`);
    }
  });

  // The keyboard must not leak or block the sign: an item whose answer or any mistake value is negative in
  // any draw gets inputMode 'text' (the keyboard with "−") on every draw.
  test(`${id}: signed items use the text keyboard on every draw`, () => {
    for (const it of [...L(2), ...L(3)]) {
      const rng = PC.makeRng(4321), modes = new Set();
      let neg = false;
      for (let i = 0; i < (it.level === 2 ? DRAWS : 1); i++) {
        const x = PC.instantiate(it, rng);
        modes.add(x.inputMode);
        if (x.answer < 0 || x.mistakes.some(mk => mk.value < 0)) neg = true;
      }
      if (neg) {
        assert.equal(it.signed, true, `${it.id}: has negative answers or mistakes, needs signed: true`);
        assert.deepEqual([...modes], ['text'], `${it.id}: inputMode per draw ${[...modes]}`);
      }
    }
  });

  // A unit written as "×10^k …" means the learner types only the number in front; typing the full value
  // (answer · 10^k) must be recognised as a right value in the wrong form, on every draw.
  test(`${id}: ×10^k units recognise the full value`, () => {
    for (const it of [...L(2), ...L(3)]) {
      if (!/^\s*[×x*·⋅]\s*10/.test(it.unit)) continue;
      const k = PC.unitPower(it.unit);
      assert.ok(Number.isInteger(k) && k !== 0, `${it.id}: unitPower(${it.unit}) = ${k}`);
      const rng = PC.makeRng(77);
      for (let i = 0; i < (it.level === 2 ? 100 : 1); i++) {
        const x = PC.instantiate(it, rng);
        assert.equal(PC.scaleSlip(x.answer * Math.pow(10, k), x.answer, x.tol, x.unit), k, `${it.id} vars=${JSON.stringify(x.vars)}`);
      }
    }
  });

  test(`${id}: L3 fixed`, () => {
    for (const it of L(3)) {
      const tol = it.tol == null ? 0.02 : it.tol;
      assert.ok(typeof it.q === 'string' && it.q.trim(), `${it.id}: q`);
      assert.ok(Number.isFinite(it.answer) && it.answer !== 0, `${it.id}: answer`);
      assert.ok(Array.isArray(it.hints) && it.hints.length >= 2, `${it.id}: >= 2 hints`);
      for (const mk of it.mistakes) {
        assert.ok(Number.isFinite(mk.value), `${it.id}: mistake value`);
        assert.ok(relDiff(mk.value, it.answer) > 2 * tol, `${it.id}: mistake ${mk.value} too close (${mk.msg})`);
        assertDiagnosis(PC, mk, it.answer, tol, it.mistakes, it.id);
      }
    }
  });

  test(`${id}: reference`, () => {
    assert.ok(ref, `missing tests/practice-ref/${id}.json`);
    for (const it of L(2)) {
      const cases = ref[it.id];
      assert.ok(Array.isArray(cases) && cases.length === 3, `${it.id}: needs 3 reference cases`);
      const keys = Object.keys(it.gen(PC.makeRng(1))).sort().join(',');
      for (const c of cases) {
        assert.equal(Object.keys(c.vars).sort().join(','), keys, `${it.id}: reference vars keys`);
        const got = it.answer(c.vars);
        assert.ok(relDiff(got, c.answer) <= REF_TOL, `${it.id} ${JSON.stringify(c.vars)}: ${got} vs ref ${c.answer}`);
      }
    }
    for (const it of L(3)) {
      assert.equal(typeof ref[it.id], 'number', `${it.id}: reference missing`);
      assert.ok(relDiff(it.answer, ref[it.id]) <= REF_TOL, `${it.id}: ${it.answer} vs ref ${ref[it.id]}`);
    }
  });

  test(`${id}: math spans balanced and not nested`, () => {
    const check = (it, vars, tag) => {
      for (const s of itemTexts(it, vars)) {   // L1: q, e, options t/why · L2/L3: q, solution, hints, mistake msgs
        if (typeof s !== 'string') continue;
        const p = mathSpanProblem(s);
        assert.equal(p, null, `${tag}: ${p} in ${JSON.stringify(s.slice(0, 160))}`);
      }
    };
    for (const it of items) {
      if (it.level === 2) {
        const rng = PC.makeRng(1234);
        for (let i = 0; i < DRAWS; i++) { const vars = it.gen(rng); check(it, vars, `${it.id} vars=${JSON.stringify(vars)}`); }
      } else {
        check(it, null, it.id);
      }
    }
  });

  test(`${id}: no Thai in \\text{}`, () => {
    for (const it of items) {
      if (it.level === 2) {
        const rng = PC.makeRng(99);
        for (let i = 0; i < 50; i++) {
          for (const s of itemTexts(it, it.gen(rng))) assert.doesNotMatch(s, THAI_IN_TEXT, it.id);
        }
      } else {
        for (const s of itemTexts(it, null)) assert.doesNotMatch(s, THAI_IN_TEXT, it.id);
      }
    }
  });
}

test('circuit: practice texts stay out of magnetism and induction', { skip: !chapters.includes('circuit') }, () => {
  const { items, PC } = load('circuit');
  const BANNED = ['แม่เหล็ก', 'เหนี่ยวนำ', 'มอเตอร์'];
  for (const it of items) {
    const rng = PC.makeRng(2024);
    const draws = it.level === 2 ? Array.from({ length: 50 }, () => it.gen(rng)) : [null];
    for (const vars of draws) {
      for (const s of itemTexts(it, vars)) {
        if (typeof s !== 'string') continue;
        for (const b of BANNED) assert.ok(!s.includes(b), `${it.id}: "${b}" in ${JSON.stringify(s.slice(0, 80))}`);
      }
    }
  }
});

test('waves-2-07 (real/virtual image sign): the same keyboard for every draw', () => {
  const { items, PC } = load('waves');
  const it = items.find(x => x.id === 'waves-2-07');
  const rng = PC.makeRng(5), modes = new Set(), signs = new Set();
  for (let i = 0; i < DRAWS; i++) { const x = PC.instantiate(it, rng); modes.add(x.inputMode); signs.add(Math.sign(x.answer)); }
  assert.deepEqual([...signs].sort(), [-1, 1], 'draws cover both signs');
  assert.deepEqual([...modes], ['text']);
});

// Worked examples (Task 4): every <h2> section of a chapter that has a practice file shows >= 1
// step-by-step example (.wx with >= 2 steps), and the old one-shot <details class="ex"> is gone.
function lectureBody(id) {
  const m = new RegExp(`<template id="lec-${id}">([\\s\\S]*?)</template>`).exec(INDEX);
  return m ? m[1] : null;
}
function lectureSections(id) {
  const body = lectureBody(id);
  if (!body) return null;
  return body.split(/(?=<h2 id=")/).slice(1).map(chunk => ({ id: /^<h2 id="([^"]+)"/.exec(chunk)[1], html: chunk }));
}
function workedBlocks(html) {
  return [...html.matchAll(/<div class="wx">([\s\S]*?)<\/ol>\s*<\/div>/g)].map(x => x[1]);
}

for (const id of chapters) {
  test(`${id}: worked coverage`, () => {
    const body = lectureBody(id);
    assert.ok(body, `no <template id="lec-${id}">`);
    assert.doesNotMatch(body, /<details class="ex"/, `lec-${id} still has <details class="ex">`);
    const secs = lectureSections(id);
    assert.ok(secs.length > 0, `no <h2 id> in lec-${id}`);
    for (const s of secs) {
      const wx = workedBlocks(s.html);
      assert.ok(wx.length >= 1, `section ${s.id} has no .wx worked example`);
      for (const w of wx) {
        assert.match(w, /^\s*<div class="wx-q">[\s\S]+?<\/div>\s*<ol class="wx-steps">/, `section ${s.id}: .wx must be .wx-q then ol.wx-steps`);
        const steps = (w.match(/<li>/g) || []).length;
        assert.ok(steps >= 2, `section ${s.id}: a .wx has ${steps} steps (needs >= 2)`);
        assert.doesNotMatch(w, THAI_IN_TEXT, `section ${s.id}: Thai inside \\text{} in a worked example`);
      }
    }
    const all = (body.match(/<div class="wx">/g) || []).length;
    const counted = secs.reduce((k, s) => k + workedBlocks(s.html).length, 0);
    assert.equal(counted, all, `lec-${id}: a .wx block does not match the markup contract`);
  });
}

test('old quiz is retired: no QUIZ data script, no renderQuiz', () => {
  assert.doesNotMatch(INDEX, /data\/quiz\.js/);
  assert.equal(fs.existsSync(path.join(ROOT, 'assets/js/data/quiz.js')), false);
  const app = fs.readFileSync(path.join(ROOT, 'assets/js/app.js'), 'utf8');
  assert.doesNotMatch(app, /renderQuiz|\bQUIZ\b|best_/);
});
