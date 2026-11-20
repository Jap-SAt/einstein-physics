/* ════════════════ practice-core: เครื่องมือหลักของบันไดแบบฝึกหัด 3 ระดับ ════════════════
   Pure functions, no DOM. Classic script (globals PracticeCore, PRACTICE) and Node require().
   PRACTICE is the shared registry that per-chapter data scripts fill (PRACTICE.mech = [...]). */
var PRACTICE = (typeof PRACTICE !== 'undefined' && PRACTICE) || {};
var PracticeCore = (function () {
  'use strict';

  var DEFAULT_TOL = 0.02;
  var PASS_NUM = 7, PASS_DEN = 10;             // pass = (ok + ok-help) / total >= 70 %
  var STATUSES = { 'ok': 1, 'ok-help': 1, 'wrong': 1 };

  /* mulberry32 */
  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function decimals(step) {
    var s = String(step), e = s.indexOf('e-');
    if (e >= 0) return parseInt(s.slice(e + 2), 10) + (s.slice(0, e).split('.')[1] || '').length;
    return (s.split('.')[1] || '').length;
  }

  function pick(rng, min, max, step) {
    var n = Math.floor((max - min) / step + 1e-9);
    var k = Math.min(n, Math.floor(rng() * (n + 1)));
    return Number((min + k * step).toFixed(decimals(step)));
  }

  var SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+' };

  function parseAnswer(str) {
    if (typeof str !== 'string') return null;
    var s = str.trim().replace(/−/g, '-');
    s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, function (m) {
      return '^' + m.split('').map(function (c) { return SUP[c]; }).join('');
    });
    /* × 10^(-13) and × 10^{-13} first, then the bare × 10^-13 (× x * · ⋅ all mean “times”) */
    s = s.replace(/\s*[×x*·⋅]\s*10\s*\^\s*[({]\s*([-+]?\d+)\s*[)}]/gi, 'e$1');
    s = s.replace(/\s*[×x*·⋅]\s*10\s*\^\s*(?=[-+]?\d)/gi, 'e');
    /* comma thousands (“12,000”, “1,234,567.5”) only when the first group does not start with 0 */
    s = s.replace(/^([-+]?[1-9]\d{0,2}(?:,\d{3})+)(?!\d)/, function (m) { return m.replace(/,/g, ''); });
    /* any other comma right after the leading digits is a decimal comma (“0,021” → 0.021) */
    s = s.replace(/^([-+]?\d*),(?=\d)/, '$1.');
    /* thousands groups separated by single spaces (“10 980”, “1 234 567.5”) */
    s = s.replace(/^([-+]?[1-9]\d{0,2}(?: \d{3})+)(?!\d)/, function (m) { return m.replace(/ /g, ''); });
    /* a space around the e of a power (“2.1 e-2”, “2.1 E -2”) */
    s = s.replace(/^([-+]?(?:\d+\.?\d*|\.\d+))\s*e\s*([-+]?)\s*(?=\d)/i, '$1e$2');
    var m = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/i.exec(s);
    if (!m) return null;
    var rest = s.slice(m[0].length);
    if (rest !== '' && !/^(?:\s|[A-Za-z°µμ%Ω]|[฀-๿])/.test(rest)) return null;
    /* any other number followed by a space and more digits (“10 98”, “2.5 3”) is unreadable, never a partial number */
    if (/^\s+[\d.]/.test(rest)) return null;
    /* after a symbol unit (“71.6°”, “56%”, “2.3 µT”) no digit or dot may follow (“71.6°5”, “5%3” are unreadable) */
    if (/^\s*[°µμ%Ω]/.test(rest) && /[\d.]/.test(rest)) return null;
    /* a half-written power of ten (“2.4 x 10-13”, “2.4 × 10^”, “2.4e(-13)”) is unreadable, never the bare 2.4 */
    /* a lone e/E not starting a letter unit (“2.1e”, “2.1 e”, “2.1 e-”) is half a power too; “7.35 eV” stays a unit */
    if (/^\s*[×x*·⋅]/i.test(rest) || /^\s*e(?![A-Za-z])/i.test(rest)) return null;
    var v = Number(m[0]);
    return isFinite(v) ? v : null;
  }

  function within(value, target, tol) {
    var scale = Math.abs(target) || 1;
    return Math.abs(value - target) <= tol * scale + 1e-12 * scale;
  }

  function checkNumeric(value, answer, tol, mistakes) {
    if (tol == null) tol = DEFAULT_TOL;
    if (typeof value !== 'number' || !isFinite(value)) return { ok: false, msg: null };
    if (within(value, answer, tol)) return { ok: true, msg: null };
    var list = mistakes || [];
    for (var i = 0; i < list.length; i++) {
      if (within(value, list[i].value, tol)) return { ok: false, msg: list[i].msg };
    }
    return { ok: false, msg: null };
  }

  /* k of a unit that starts with a ×10^k factor (“×10⁶ m/s”, “×10^6 m/s”, “× 10^(-15) m”), else null */
  function unitPower(unit) {
    if (typeof unit !== 'string') return null;
    var s = unit.trim().replace(/−/g, '-').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, function (m) {
      return '^' + m.split('').map(function (c) { return SUP[c]; }).join('');
    });
    var m = /^[×x*·⋅]\s*10\s*\^\s*(?:[({]\s*([-+]?\d+)\s*[)}]|([-+]?\d+))/i.exec(s);
    if (!m) return null;
    var k = parseInt(m[1] || m[2], 10);
    return k ? k : null;
  }

  /* the learner typed the right value in full (answer · 10^k) into a field whose unit already says ×10^k:
     returns k, else null. A value that is already right is never a slip. */
  function scaleSlip(value, answer, tol, unit) {
    if (tol == null) tol = DEFAULT_TOL;
    if (typeof value !== 'number' || !isFinite(value) || within(value, answer, tol)) return null;
    var k = unitPower(unit);
    return k !== null && within(value, answer * Math.pow(10, k), tol) ? k : null;
  }

  function instantiate(item, rng) {
    var vars = typeof item.gen === 'function' ? item.gen(rng) : null;
    var out = {};
    Object.keys(item).forEach(function (k) {
      if (k === 'gen') return;
      out[k] = typeof item[k] === 'function' ? item[k](vars) : item[k];
    });
    out.vars = vars;
    if (out.tol == null) out.tol = DEFAULT_TOL;
    if (out.unit == null) out.unit = '';
    if (!Array.isArray(out.hints)) out.hints = [];
    if (!Array.isArray(out.mistakes)) out.mistakes = [];
    /* element-level functions: hints [string | (vars) → string], mistakes [{ value | (vars) → number, msg }] */
    out.hints = out.hints.map(function (h) { return typeof h === 'function' ? h(vars) : h; });
    out.mistakes = out.mistakes.map(function (m) {
      return { value: typeof m.value === 'function' ? m.value(vars) : m.value, msg: m.msg };
    });
    if (out.solution == null) out.solution = '';
    var a = out.answer;
    out.inputMode = (typeof a === 'number' && (a < 0 || Math.abs(a) < 1e-3 || a >= 1e5)) ? 'text' : 'decimal';
    return out;
  }

  function classify(r) {
    if (!r.correct || r.skipped || r.sawSolution) return 'wrong';
    return ((r.tries || 1) > 2 || r.usedHint) ? 'ok-help' : 'ok';
  }

  function readRecord(raw) {
    var rec = { v: 1, items: {} };
    if (!raw || typeof raw !== 'object' || raw.v !== 1 || !raw.items || typeof raw.items !== 'object') return rec;
    Object.keys(raw.items).forEach(function (id) {
      var e = raw.items[id];
      if (e && typeof e === 'object' && STATUSES[e.s] === 1) rec.items[id] = { s: e.s, n: Number(e.n) || 0, t: Number(e.t) || 0 };
    });
    return rec;
  }

  function summarize(items, record) {
    var rec = (record && record.items) || {};
    var out = [];
    for (var level = 1; level <= 3; level++) {
      var row = { level: level, total: 0, ok: 0, okHelp: 0, wrong: 0, todo: 0, passed: false };
      items.forEach(function (it) {
        if (it.level !== level) return;
        row.total++;
        var s = rec[it.id] && rec[it.id].s;
        if (s === 'ok') row.ok++;
        else if (s === 'ok-help') row.okHelp++;
        else if (s === 'wrong') row.wrong++;
        else row.todo++;
      });
      row.passed = row.total > 0 && (row.ok + row.okHelp) * PASS_DEN >= row.total * PASS_NUM;
      out.push(row);
    }
    return out;
  }

  /* First unpassed level that has items; otherwise redo wrong items; otherwise move on. */
  function recommend(summary, record, items) {
    for (var i = 0; i < summary.length; i++) {
      if (summary[i].total > 0 && !summary[i].passed) return { kind: 'level', level: summary[i].level };
    }
    var rec = (record && record.items) || {}, count = 0;
    items.forEach(function (it) { if (rec[it.id] && rec[it.id].s === 'wrong') count++; });
    return count > 0 ? { kind: 'redo', count: count } : { kind: 'next' };
  }

  function fmt(x, sig) {
    if (sig == null) sig = 3;
    if (x === 0) return '0';
    var plain = Number(x.toPrecision(sig));
    if (Math.abs(x) >= 1e-3 && Math.abs(plain) < 1e5) return String(plain);
    var parts = x.toExponential(sig - 1).split('e');
    return '\\(' + parts[0] + ' \\times 10^{' + parseInt(parts[1], 10) + '}\\)';
  }

  var api = {
    makeRng: makeRng, pick: pick, parseAnswer: parseAnswer, checkNumeric: checkNumeric,
    unitPower: unitPower, scaleSlip: scaleSlip,
    instantiate: instantiate, classify: classify, summarize: summarize, recommend: recommend,
    readRecord: readRecord, fmt: fmt
  };
  return api;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PracticeCore;
