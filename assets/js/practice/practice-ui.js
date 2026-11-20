/* ════════════════ practice-ui: แผนที่ระดับ · ตัวทำโจทย์ทีละข้อ · ความคืบหน้า ════════════════
   Global PracticeUI = { render(tv, m), progressText(id), solved(id), enhanceWorked(root) }.
   Progress lives in store key practice_<id> (localStorage einstein_practice_<id>) and is always
   read through PracticeCore.readRecord. Every screen render bumps `token`; async work (MathJax,
   timers) checks it first, so a stale callback never writes into a newer item (Review Focus 5). */
var PracticeUI = (function () {
  'use strict';
  var PC = PracticeCore;
  var LEVEL_NAMES = { 1: 'เข้าใจแนวคิด', 2: 'คำนวณ', 3: 'โจทย์ประยุกต์' };
  var LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'];
  var DOT_CLASS = { 'ok': 'ok', 'ok-help': 'okh', 'wrong': 'no' };
  var DOT_TEXT = { 'ok': 'ถูกเอง', 'ok-help': 'ถูกหลังใช้ตัวช่วย', 'wrong': 'ยังผิด' };

  var token = 0;
  var mjChain = Promise.resolve();
  var cur = null;   // { m, tv, items, session, inst, st, el }

  /* ── progress ── */
  function key(id) { return 'practice_' + id; }
  function load(id) { return PC.readRecord(store.get(key(id), null)); }
  function save(id, itemId, s) {
    var rec = load(id), prev = rec.items[itemId];
    rec.items[itemId] = { s: s, n: (prev ? prev.n : 0) + 1, t: Date.now() };
    store.set(key(id), rec);
  }
  function statusOf(rec, itemId) { var e = rec.items[itemId]; return e ? e.s : null; }

  function solved(id) {
    var items = PRACTICE[id] || [], rec = load(id), done = 0, touched = 0;
    items.forEach(function (it) {
      var s = statusOf(rec, it.id);
      if (s) touched++;
      if (s === 'ok' || s === 'ok-help') done++;
    });
    return { done: done, total: items.length, touched: touched };
  }
  function progressText(id) {
    var p = solved(id);
    return p.touched ? p.done + '/' + p.total : 'ยังไม่เริ่ม';
  }

  /* ── helpers ── */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function q(sel) { return cur.el.querySelector(sel); }
  function seed() { return (Math.random() * 4294967296) >>> 0; }

  /* typeset only while the screen that asked for it is still the current one; one MathJax job at a time */
  function tset(el, tok) {
    if (tok == null) tok = token;
    if (tok !== token || !el.isConnected) return;
    if (!(window.MathJax && MathJax.typesetPromise)) { setTimeout(function () { tset(el, tok); }, 150); return; }
    mjChain = mjChain.then(function () {
      if (tok === token && el.isConnected) return MathJax.typesetPromise([el]);
    }).catch(function () {});
  }
  /* forget MathJax items of a screen we are about to throw away */
  function release(el) {
    if (!el) return;
    mjChain = mjChain.then(function () {
      if (window.MathJax && MathJax.typesetClear) MathJax.typesetClear([el]);
    }).catch(function () {});
  }
  function newScreen() {
    token++;
    if (cur.el) release(cur.el);
    cur.inst = null; cur.st = null;
  }

  /* ════════ level map ════════ */
  function render(tv, m) {
    cur = { m: m, tv: tv, items: PRACTICE[m.id], session: null, inst: null, st: null, el: null };
    showMap();
  }

  function showMap(note) {
    newScreen();
    var m = cur.m, items = cur.items, rec = load(m.id);
    var sum = PC.summarize(items, rec), rc = PC.recommend(sum, rec, items);
    var wrongIds = items.filter(function (it) { return statusOf(rec, it.id) === 'wrong'; });
    var touched = items.some(function (it) { return statusOf(rec, it.id); });
    var idx = MODS.findIndex(function (x) { return x.id === m.id; }), nx = MODS[idx + 1];

    var rows = sum.filter(function (r) { return r.total > 0; }).map(function (r) {
      var lv = items.filter(function (it) { return it.level === r.level; });
      var isRec = rc.kind === 'level' && rc.level === r.level;
      var go = r.todo === r.total ? 'เริ่ม' : r.todo > 0 ? 'ทำต่อ' : 'ทำอีกรอบ';
      var dots = lv.map(function (it) {
        var s = statusOf(rec, it.id);
        return '<i class="px-dot' + (s ? ' ' + DOT_CLASS[s] : '') + '" title="' + (s ? DOT_TEXT[s] : 'ยังไม่ทำ') + '"></i>';
      }).join('');
      var sub = r.todo === r.total ? lv.length + ' ข้อ' :
        'ถูกเอง ' + r.ok + ' · ใช้ตัวช่วย ' + r.okHelp + ' · ยังผิด ' + r.wrong + ' · ยังไม่ทำ ' + r.todo;
      return '<div class="px-row' + (isRec ? ' rec' : '') + '" data-level="' + r.level + '">' +
        '<div class="px-lhead"><span class="px-lname">ระดับ ' + r.level + ' · ' + LEVEL_NAMES[r.level] + '</span>' +
        (isRec ? '<span class="px-rec">แนะนำ</span>' : '') + '<div class="px-sub">' + sub + '</div></div>' +
        '<div class="px-dots" aria-label="ถูก ' + (r.ok + r.okHelp) + ' ยังผิด ' + r.wrong + ' ยังไม่ทำ ' + r.todo + '">' + dots + '</div>' +
        '<span class="px-count mono">' + (r.ok + r.okHelp) + '/' + r.total + '</span>' +
        '<button class="btn btn-sm px-go ' + (isRec ? 'btn-primary' : 'btn-ghost') + '">' + go + '</button></div>';
    }).join('');

    var foot = '';
    if (wrongIds.length) foot += '<button class="btn btn-sm px-redo ' + (rc.kind === 'redo' ? 'btn-primary' : 'btn-ghost') + '">ทำข้อที่ยังผิด (' + wrongIds.length + ')</button>' +
      (rc.kind === 'redo' ? '<span class="px-rec">แนะนำ</span>' : '');
    if (rc.kind === 'next') foot += nx ? '<a class="btn btn-sm btn-primary" href="#' + nx.id + '">บทถัดไป: ' + nx.title + '</a><span class="px-rec">แนะนำ</span>'
      : '<a class="btn btn-sm btn-primary" href="#home">กลับหน้าแรก</a>';
    if (touched) foot += '<button class="px-reset">ล้างความคืบหน้าบทนี้</button>';

    cur.tv.innerHTML = '<div class="quiz px px-map"><div class="kicker">แบบฝึกหัด · ' + m.title + '</div>' +
      '<p class="px-intro">เลือกระดับไหนก็ได้ ไม่ล็อก · ผ่านระดับเมื่อทำถูก 70% ของข้อในระดับ</p>' +
      (note ? '<div class="px-note">' + note + '</div>' : '') +
      '<div class="px-levels">' + rows + '</div>' +
      (foot ? '<div class="px-foot">' + foot + '</div>' : '') +
      '<div class="px-legend"><span><i class="px-sw ok"></i>ถูกเอง</span><span><i class="px-sw okh"></i>ถูกหลังใช้ตัวช่วย</span>' +
      '<span><i class="px-sw no"></i>ยังผิด</span><span><i class="px-sw"></i>ยังไม่ทำ</span></div></div>';
    cur.el = cur.tv.firstChild;

    cur.el.querySelectorAll('.px-row').forEach(function (row) {
      row.querySelector('.px-go').onclick = function () {
        var level = +row.dataset.level, r = sum[level - 1];
        var list = items.filter(function (it) { return it.level === level; });
        var start = 0;
        if (r.todo > 0 && r.todo < r.total) start = list.findIndex(function (it) { return !statusOf(load(m.id), it.id); });
        startSession(list, Math.max(0, start), 'ระดับ ' + level + ' · ' + LEVEL_NAMES[level]);
      };
    });
    var redo = q('.px-redo');
    if (redo) redo.onclick = function () {
      var r = load(m.id);
      startSession(items.filter(function (it) { return statusOf(r, it.id) === 'wrong'; }), 0, 'ทบทวนข้อที่ยังผิด');
    };
    var reset = q('.px-reset');
    if (reset) reset.onclick = function () {
      if (!confirm('ล้างความคืบหน้าแบบฝึกหัดของบท “' + m.title + '” ทั้งหมด?')) return;
      try { localStorage.removeItem('einstein_' + key(m.id)); } catch (e) {}
      showMap();
    };
  }

  /* ════════ item runner ════════ */
  function startSession(list, idx, label) {
    if (!list.length) return showMap();
    cur.session = { list: list, idx: idx, label: label };
    showItem();
  }

  function sessionDots() {
    var rec = load(cur.m.id), s = cur.session;
    return s.list.map(function (it, k) {
      var st = statusOf(rec, it.id);
      return '<i class="' + (st ? DOT_CLASS[st] : '') + (k === s.idx ? ' cur' : '') + '"></i>';
    }).join('');
  }
  function refreshDots() { var d = q('.qdots'); if (d) d.innerHTML = sessionDots(); }

  function showItem(inst) {
    newScreen();
    var tok = token, s = cur.session, it = s.list[s.idx];
    inst = inst || PC.instantiate(it, PC.makeRng(seed()));
    var st = { tries: 0, usedHint: false, sawSolution: false, done: false, hints: 0, pick: -1 };
    cur.inst = inst; cur.st = st;
    var lvTag = s.label.indexOf('ระดับ') === 0 ? '' : '<span class="px-tag">ระดับ ' + it.level + '</span>';
    var body = it.type === 'mcq' ? mcqHTML(inst) : numHTML(inst, it);
    cur.tv.innerHTML = '<div class="quiz px px-run">' +
      '<div class="px-top"><button class="px-back">← แผนที่ระดับ</button><span class="mono px-pos">ข้อ ' + (s.idx + 1) + '/' + s.list.length + '</span></div>' +
      '<div class="kicker">' + s.label + '</div><div class="qdots">' + sessionDots() + '</div>' +
      '<div class="qcard px-item" data-id="' + it.id + '">' + lvTag + body + '</div></div>';
    cur.el = cur.tv.firstChild;
    q('.px-back').onclick = function () { showMap(); };
    if (it.type === 'mcq') wireMcq(inst, st); else wireNum(inst, it, st);
    if (cur.tv.getBoundingClientRect().top < 0) window.scrollTo(0, 0);
    tset(q('.px-item'), tok);
  }

  function nextLabel() { return cur.session.idx < cur.session.list.length - 1 ? 'ข้อถัดไป' : 'จบชุดนี้'; }
  function goNext() {
    var s = cur.session;
    if (s.idx < s.list.length - 1) { s.idx++; showItem(); return; }
    var rec = load(cur.m.id), right = s.list.filter(function (it) { var x = statusOf(rec, it.id); return x === 'ok' || x === 'ok-help'; }).length;
    showMap('จบชุด “' + s.label + '” แล้ว · ตอนนี้ถูก <span class="mono">' + right + '/' + s.list.length + '</span> ข้อ');
  }

  /* ── multiple choice (level 1): one answer per round, then the explanation ── */
  function mcqHTML(inst) {
    var order = inst.options.map(function (_, k) { return k; });
    for (var k = order.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)), t = order[k]; order[k] = order[j]; order[j] = t; }
    return '<div class="qtext px-q">' + inst.q + '</div><div class="px-opts">' +
      order.map(function (oi, k) { return '<button class="opt" data-oi="' + oi + '" data-k="' + LETTERS[k] + '"><span class="k">' + LETTERS[k] + '</span><span>' + inst.options[oi].t + '</span></button>'; }).join('') +
      '</div><div class="px-fb" aria-live="polite"></div>' +
      '<div class="px-actions"><span class="px-gap"></span><button class="btn btn-primary px-check" disabled>ตรวจคำตอบ</button>' +
      '<button class="btn btn-primary px-next" hidden>' + nextLabel() + '</button></div>';
  }

  function wireMcq(inst, st) {
    var opts = cur.el.querySelectorAll('.opt');
    q('.px-opts').onclick = function (e) {
      var b = e.target.closest('.opt'); if (!b || st.done) return;
      st.pick = +b.dataset.oi;
      opts.forEach(function (x) { x.classList.toggle('sel', x === b); });
      q('.px-check').disabled = false;
    };
    q('.px-check').onclick = function () {
      if (st.done || st.pick < 0) return;
      st.done = true; st.tries = 1;
      var ok = st.pick === inst.a, chosen = cur.el.querySelector('.opt[data-oi="' + st.pick + '"]');
      save(cur.m.id, inst.id, PC.classify({ correct: ok, tries: 1, usedHint: false, sawSolution: false, type: 'mcq' }));
      opts.forEach(function (x) {
        x.disabled = true; x.classList.remove('sel');
        var oi = +x.dataset.oi;
        if (oi === inst.a) x.classList.add('right'); else if (oi === st.pick) x.classList.add('wrong');
      });
      var fb = q('.px-fb');
      fb.innerHTML = '<div class="fb ' + (ok ? 'ok' : 'no') + '"><b>' + (ok ? 'ถูกต้อง' : 'ยังไม่ถูก') + '</b>' +
        (ok ? '' : '<div class="px-why"><span class="px-lab">ทำไมข้อ ' + chosen.dataset.k + ' จึงไม่ถูก</span>' + inst.options[st.pick].why + '</div>') +
        '<div class="px-e"><span class="px-lab">' + (ok ? 'เหตุผล' : 'คำตอบที่ถูกและเหตุผล') + '</span>' + inst.e + '</div></div>';
      q('.px-check').hidden = true;
      var nb = q('.px-next'); nb.hidden = false; nb.onclick = goNext;
      refreshDots();
      tset(fb);
    };
  }

  /* ── numeric (levels 2–3): unlimited tries, hints, full solution, new numbers on level 2 ── */
  function numHTML(inst, it) {
    var n = inst.hints.length, text = inst.inputMode === 'text';
    return '<div class="qtext px-q">' + inst.q + '</div>' +
      '<div class="px-ans"><input class="px-in mono" type="text" inputmode="' + (text ? 'text' : 'decimal') + '" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="คำตอบ' + (inst.unit ? ' (' + esc(inst.unit) + ')' : '') + '">' +
      (inst.unit ? '<span class="px-unit">' + esc(inst.unit) + '</span>' : '') +
      '<button class="btn btn-primary px-check">ตรวจคำตอบ</button></div>' +
      (text ? '<div class="px-help">พิมพ์แบบ 2.1e-2 ได้</div>' : '') +
      '<div class="px-fb" aria-live="polite"></div><div class="px-hints"></div><div class="px-solution" hidden></div>' +
      '<div class="px-actions">' +
      (n ? '<button class="btn btn-ghost btn-sm px-hintbtn">คำใบ้ 1/' + n + '</button>' : '') +
      '<button class="btn btn-ghost btn-sm px-solbtn">ดูวิธีทำ</button>' +
      (it.level === 2 ? '<button class="btn btn-ghost btn-sm px-newbtn" hidden>ตัวเลขชุดใหม่</button>' : '') +
      '<span class="px-gap"></span><button class="btn btn-ghost btn-sm px-skip" hidden>ข้ามข้อนี้</button>' +
      '<button class="btn btn-primary btn-sm px-next" hidden>' + nextLabel() + '</button></div>';
  }

  function wireNum(inst, it, st) {
    var input = q('.px-in'), check = q('.px-check'), fb = q('.px-fb');
    var unit = inst.unit ? ' ' + esc(inst.unit) : '';
    function say(cls, html) { fb.innerHTML = '<div class="fb ' + cls + '">' + html + '</div>'; tset(fb); }
    function lock() { input.disabled = true; check.disabled = true; q('.px-skip').hidden = true; }
    function finish() {
      lock();
      var nb = q('.px-next'); nb.hidden = false; nb.onclick = goNext;
      var nw = q('.px-newbtn'); if (nw) nw.hidden = false;
      refreshDots();
    }

    function submit() {
      if (st.done || st.sawSolution) return;
      var raw = input.value, x = PC.parseAnswer(raw);
      if (x === null) { say('warn', '<b>อ่านตัวเลขไม่ออก</b>ลองพิมพ์แบบ 2.1e-2 (ไม่นับเป็นการตอบ)'); return; }
      st.tries++;
      var r = PC.checkNumeric(x, inst.answer, inst.tol, inst.mistakes);
      if (r.ok) {
        st.done = true;
        var s = PC.classify({ correct: true, tries: st.tries, usedHint: st.usedHint, sawSolution: false, type: 'num' });
        save(cur.m.id, inst.id, s);
        say('ok', '<b>ถูกต้อง</b>คำตอบ ≈ <span class="mono">' + PC.fmt(inst.answer) + '</span>' + unit +
          (s === 'ok-help' ? ' · นับเป็นถูกหลังใช้ตัวช่วย (เปิดคำใบ้หรือตอบเกิน 2 ครั้ง)' : ''));
        finish();
      } else {
        say('no', '<b>✗ <span class="mono">' + esc(raw.trim()) + '</span>' + unit + '</b>' +
          (r.msg || 'ยังไม่ถูก ลองตรวจการคำนวณอีกครั้ง') + ' · ลองใหม่ได้');
        q('.px-skip').hidden = false;
      }
    }
    check.onclick = submit;
    input.onkeydown = function (e) { if (e.key === 'Enter') submit(); };

    var hb = q('.px-hintbtn');
    if (hb) hb.onclick = function () {
      var n = inst.hints.length;
      if (st.hints >= n) return;
      if (!st.done && !st.sawSolution) st.usedHint = true;
      st.hints++;
      var h = document.createElement('div');
      h.className = 'px-hint';
      h.innerHTML = '<span class="px-lab">คำใบ้ ' + st.hints + '</span>' + inst.hints[st.hints - 1];
      q('.px-hints').appendChild(h);
      hb.textContent = 'คำใบ้ ' + Math.min(st.hints + 1, n) + '/' + n;
      hb.disabled = st.hints >= n;
      tset(h);
    };

    q('.px-solbtn').onclick = function () {
      var sol = q('.px-solution');
      if (!sol.hidden) return;
      sol.innerHTML = '<span class="px-lab">วิธีทำ</span>' + inst.solution;
      sol.hidden = false;
      q('.px-solbtn').disabled = true;
      if (!st.done) {
        st.sawSolution = true;
        save(cur.m.id, inst.id, PC.classify({ correct: false, sawSolution: true, tries: st.tries, type: 'num' }));
        say('no', '<b>เปิดวิธีทำแล้ว</b>ข้อนี้ยังไม่นับว่าถูก · ' + (it.level === 2
          ? 'กด “ตัวเลขชุดใหม่” แล้วลองทำเองอีกครั้ง' : 'กลับมาทำใหม่ได้ในรอบถัดไปของระดับนี้'));
        finish();
      }
      tset(sol);
    };

    q('.px-skip').onclick = function () {
      if (st.done || st.sawSolution || !st.tries) return;
      save(cur.m.id, inst.id, PC.classify({ correct: false, skipped: true, tries: st.tries, type: 'num' }));
      goNext();
    };

    var nw = q('.px-newbtn');
    if (nw) nw.onclick = function () {
      var before = JSON.stringify(inst.vars), next;
      for (var k = 0; k < 12; k++) {
        next = PC.instantiate(it, PC.makeRng(seed()));
        if (JSON.stringify(next.vars) !== before) break;
      }
      showItem(next);
    };
  }

  /* Task 4 fills this in (worked-example stepper in the lecture). */
  function enhanceWorked() {}

  window.__px = {
    current: function () { return cur ? cur.inst : null; },
    session: function () { return cur && cur.session ? cur.session.list.map(function (it) { return it.id; }) : null; },
    state: function () { return cur ? cur.st : null; }
  };

  return { render: render, progressText: progressText, solved: solved, enhanceWorked: enhanceWorked };
})();
