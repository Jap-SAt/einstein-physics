# Practice Ladder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn every chapter's quiz into a 20-item, 3-level practice ladder (concept MCQ / randomized calculation / multi-step applied), with typed numeric answers, mistake detection, hints, local progress, and step-by-step worked examples in every lecture section.

**Architecture:** A pure engine (`PracticeCore`, usable in Node and the browser) owns RNG, answer parsing/checking, item instantiation and progress rules. Content lives in one classic-script data file per chapter (`PRACTICE.<id> = [...]`) and is verified by Node tests against reference answers computed independently in Python. A browser UI (`PracticeUI`) renders the level map, item runner and worked-example steppers; `app.js` routes the existing `#<id>-quiz` tab to it.

**Tech Stack:** Classic scripts (no bundler), MathJax 3.2.2 tex-svg, Tailwind 3 prebuilt + `assets/css/style.css`, Node 22 `node:test`, Python 3 (reference answers), Playwright (Python, `tests/e2e/harness.py`).

**Spec:** `docs/superpowers/specs/2026-11-20-practice-ladder-design.md`

## Global Constraints

- 7 chapters `mech, thermo, waves, particle, em, atom, nuclear`; **20 items each: level 1 = 7 (`mcq`), level 2 = 7 (`num`, randomized), level 3 = 6 (`num`, fixed)**; existing 55 quiz items are revised and counted inside the 140.
- Numeric check: relative tolerance `tol = 0.02` unless an item sets its own; correct ⇔ `|x − ans| ≤ tol·|ans|`.
- Every `mistakes[].value` must differ from the correct answer by more than `2·tol` relative.
- Item `id` format `<chapter>-<level>-<nn>` (e.g. `mech-2-03`), never changed after merge.
- Progress key `einstein_practice_<id>` = `{ v: 1, items: { [itemId]: { s: 'ok'|'ok-help'|'wrong', n, t } } }` via `store.get/set` (helpers.js adds the `einstein_` prefix).
- Status = most recent finished attempt; `ok` = correct with no hint/solution and ≤ 2 typed tries; `ok-help` = correct after a hint or > 2 tries; `wrong` = L1 wrong pick, or L2/L3 solution opened before correct, or skipped after a wrong try.
- Level "passed" = (`ok` + `ok-help`) ≥ 70 % of the level's items. Levels are never locked.
- Units in the answer box follow the chapter's usual unit (m, cm, nm, eV, MeV, u, °C, kJ…); constants and g are stated in every question.
- Route `#<id>-quiz` keeps working; tab label becomes **แบบฝึกหัด**.
- Thai copy everywhere; never Thai inside MathJax `\text{}`; numbers that change use `.mono`; works from `file://` (no fetch); light + dark themes; usable at 390 px width.
- Every lecture `<h2>` section (35 total) has ≥ 1 worked example in the stepper format; the 9 existing `<details class="ex">` are converted.
- Level 1+2 of a chapter touch every `<h2>` section of that chapter at least once; level 3 needs ≥ 2 concepts/steps per item and stays within what the lecture teaches.
- Content method per item: Feynman (learner view) → expert check → fix; one review note file per chapter `docs/superpowers/content-review/<id>.md`.

## Review Focus

1. Answers typed with a unit or Thai word ("7.35 m", "7.35 เมตร") → accepted as 7.35, not "อ่านตัวเลขไม่ออก". (Task 1 test `parse strips trailing unit text`.)
2. Negative answers typed with ASCII hyphen or Unicode minus, and mobile keyboards that lack "−"/"e" → those items get a text keyboard. (Task 1 parse tests; Task 3 test `test_input_mode`.)
3. Corrupt, old-format or foreign progress JSON in localStorage → page still renders with empty progress. (Task 3 test `test_corrupt_progress`.)
4. Progress that references item ids no longer in the data → ignored in counts, no crash. (Task 1 test `summary ignores unknown ids`.)
5. Rapid "ตัวเลขชุดใหม่" clicks / MathJax still typesetting the previous text → question, answer and solution always belong to the same number set. (Task 3 test `test_rapid_new_numbers`.)

---

### Task 1: Practice engine (`PracticeCore`)

**Files:**
- Create: `assets/js/practice/practice-core.js`
- Test: `tests/practice-core.test.js`

**Interfaces:**
- Produces (global `PracticeCore`, also `module.exports`; global `PRACTICE = {}` created here):
  - `makeRng(seed: number) → () => number` (mulberry32, deterministic, [0,1))
  - `pick(rng, min, max, step) → number` (uniform on the grid `min + k·step`, rounded to `step`'s decimals)
  - `parseAnswer(str: string) → number | null`
  - `checkNumeric(value: number, answer: number, tol = 0.02, mistakes: [{ value: number, msg: string }] = []) → { ok: boolean, msg: string | null }`
  - `instantiate(item, rng) → { id, level, type, vars, q, answer, unit, tol, hints: string[], mistakes: [{value,msg}], solution: string, inputMode: 'decimal' | 'text' }` (fixed items: `vars = null`, function fields called with `vars` only when they are functions)
  - `classify({ correct: boolean, tries: number, usedHint: boolean, sawSolution: boolean, skipped: boolean, type }) → 'ok' | 'ok-help' | 'wrong'`
  - `summarize(items, record) → [{ level, total, ok, okHelp, wrong, todo, passed: boolean }]` for levels 1–3
  - `recommend(summary, record, items) → { kind: 'level', level } | { kind: 'redo', count } | { kind: 'next' }`
  - `readRecord(raw) → { v: 1, items: {} }` (normalizes anything invalid to empty)
  - `fmt(x: number, sig = 3) → string` (display form used in questions/solutions: plain for 1e-3 ≤ |x| < 1e5, else `a × 10^{n}` in MathJax `\(…\)` form; thousands without separators)

- [ ] **Step 1: Write the failing tests** in `tests/practice-core.test.js` (`require('../assets/js/practice/practice-core.js')`):
  - `rng is deterministic`: `makeRng(7)` twice → same first 5 values; values in [0,1).
  - `pick stays on grid`: 1000 draws of `pick(rng, 5, 20, 0.5)` all in [5,20] and `(x*2) % 1 === 0`.
  - `parse formats`: each of `'0.021' '.021' '2.1e-2' '2.1E-2' '2.1×10^-2' '2.1x10^-2' '2.1*10^-2' '2.1 × 10⁻²' ' 2.1e-2 '` → 0.021 (±1e-12); `'12,000'` → 12000; `'−4.2'` and `'-4.2'` → −4.2; `'abc'`, `''`, `'1.2.3'` → null.
  - `parse strips trailing unit text`: `'7.35 m'`, `'7.35 เมตร'`, `'7.35m/s'` → 7.35.
  - `check tolerance`: `checkNumeric(7.49, 7.35)` ok (1.9 %), `checkNumeric(7.6, 7.35)` not ok; `checkNumeric(14.7, 7.35, 0.02, [{ value: 14.7, msg: 'ลืมหาร 2' }])` → `{ ok: false, msg: 'ลืมหาร 2' }`; negative answers use `|ans|`.
  - `classify rules`: `{correct:true,tries:1}` → ok; `{correct:true,tries:3}` → ok-help; `{correct:true,usedHint:true,tries:1}` → ok-help; `{correct:true,sawSolution:true}` → wrong; `{correct:false,skipped:true}` → wrong; mcq `{correct:false,tries:1,type:'mcq'}` → wrong.
  - `summary and pass`: 7 L1 items with 5 ok → L1 `passed === true` (5/7 = 71 %); 4 ok → false.
  - `summary ignores unknown ids`: record with `{ 'mech-9-99': {s:'ok'} }` → all counts 0, no throw.
  - `recommend`: first unpassed level; all passed + a wrong item → `{kind:'redo',count:1}`; all passed, none wrong → `{kind:'next'}`.
  - `fmt`: `fmt(7.3469)` → `'7.35'`; `fmt(0.000021)` contains `2.10` and `10^{-5}`; `parseAnswer` of the plain outputs round-trips within 0.5 %.
  - `readRecord`: `null`, `'x'`, `{bad:1}`, `{v:2,items:{}}` → `{v:1,items:{}}`.
  - `instantiate`: an L2 test item with `gen`, `q(vars)`, `answer(vars)` → same seed gives same `q`/`answer`; `inputMode` is `'text'` when `answer < 0` or `|answer| < 1e-3` or `≥ 1e5`, else `'decimal'`.

- [ ] **Step 2: Run** `node --test tests/*.test.js` — Expected: practice-core tests FAIL (`Cannot find module`), cosmos tests still pass.

- [ ] **Step 3: Implement `assets/js/practice/practice-core.js`** with the interfaces above. `parseAnswer`: normalise (trim, `−`→`-`, superscript digits/minus → `^digits`, `×|x|\*` before `10^` → `e`, drop thousands commas only when the pattern is `\d{1,3}(,\d{3})+`), then match a leading number `^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?` and ignore the rest only if the rest starts with whitespace, a letter or Thai (not another digit/dot).

- [ ] **Step 4: Run** `node --test tests/*.test.js` — Expected: all PASS.

- [ ] **Step 5: Commit** `feat(practice): engine — rng, answer parsing, checking, progress rules`.

---

### Task 2: Content validator + mechanics content (20 items)

**Files:**
- Create: `tests/practice-content.test.js`, `tests/practice-ref/compute_mech.py`, `tests/practice-ref/mech.json`, `assets/js/data/practice/mech.js`, `docs/superpowers/content-review/mech.md`
- Modify: `index.html` (add `<script src="assets/js/practice/practice-core.js">` and `assets/js/data/practice/mech.js` after `data/quiz.js`)

**Interfaces:**
- Consumes: `PracticeCore` (Task 1).
- Produces: item schema used by every chapter task —
  - L1 `{ id, level: 1, type: 'mcq', topic: 's<n>', q, options: [{ t, why }], a, e }` (`why` required for every wrong option, `''` for the right one)
  - L2 `{ id, level: 2, type: 'num', topic, gen(rng) → vars, q(vars), answer(vars), unit, range: [min, max], tol?, mistakes: [{ value(vars), msg }], hints: [string | (vars) → string], solution(vars) }`
  - L3 `{ id, level: 3, type: 'num', topics: ['s<n>', …≥2], q, answer, unit, tol?, mistakes: [{ value, msg }], hints: [≥2], solution }`
  - `topic`/`topics` = the lecture `<h2 id>` (e.g. `s2`) the item exercises.
  - Reference file `tests/practice-ref/<id>.json`: `{ "<L2 id>": [{ "vars": {...}, "answer": n } ×3], "<L3 id>": n }` produced by `compute_<id>.py` (Python, written from the question text, not from the JS).
  - `tests/practice-content.test.js` loads every `assets/js/data/practice/*.js` with `vm` into a context containing `PracticeCore` and `PRACTICE`, and runs the checks below for every chapter file present (so later tasks only add files).

- [ ] **Step 1: Write the failing validator tests** (per chapter file found):
  - `counts`: 20 items, levels 7/7/6, ids unique and match `^<id>-[123]-\d\d$`.
  - `coverage`: every `<h2 id>` inside `<template id="lec-<id>">` in `index.html` appears as a `topic` of some L1 or L2 item; every L3 has ≥ 2 distinct `topics`.
  - `mcq`: 4 options, distinct `t`, `a` in range, non-empty `why` for each wrong option.
  - `L2 randomized`: 500 draws with `makeRng(1234)` → answer finite, ≠ 0, within `range`; `q(vars)` and `solution(vars)` contain no `undefined`/`NaN`; each mistake differs from the answer by > 2·tol relative.
  - `solution matches answer`: for L2 (3 seeds) and L3, the solution text contains `PracticeCore.fmt(answer)`.
  - `L3 fixed`: answer finite ≠ 0, mistakes > 2·tol away, ≥ 2 hints.
  - `reference`: every L2 id has 3 reference cases and `answer(vars)` matches each within 0.5 %; every L3 `answer` matches the reference within 0.5 %.
  - `no Thai in \text{}`: no `\text{` argument containing Thai in any string/function output (`/\\text\{[^}]*[฀-๿]/`).
  Run `node --test tests/*.test.js` — Expected: FAIL (no `mech` data yet / reference missing).

- [ ] **Step 2: Write the mechanics content** — 20 items covering `s1`–`s6` of `lec-mech` (units & vectors, constant acceleration, projectile, Newton's laws, work-energy-momentum, circular motion & gravitation). Revise the 8 existing `QUIZ.mech` items into this set. For each item, write the Feynman/expert check result as one line in `docs/superpowers/content-review/mech.md`.

- [ ] **Step 3: Write `tests/practice-ref/compute_mech.py`** from the question texts and run `python3 tests/practice-ref/compute_mech.py > tests/practice-ref/mech.json`.

- [ ] **Step 4: Run** `node --test tests/*.test.js` — Expected: all PASS. Any reference mismatch is a content bug: fix the item (never the reference) unless the review note shows the reference misread the question.

- [ ] **Step 5: Commit** `feat(practice): content validator and mechanics practice set`.

---

### Task 3: Practice UI (level map, item runner, progress)

**Files:**
- Create: `assets/js/practice/practice-ui.js`, `tests/e2e/test_practice_ui.py`
- Modify: `assets/js/app.js` (tab label `แบบฝึกหัด`; `quiz` tab → `PracticeUI.render(tv, m)` when `PRACTICE[m.id]` exists, else old `renderQuiz`; lecture next-card text `แบบฝึกหัด 20 ข้อ · ทำถูกแล้ว n`; home badge reads `PracticeUI.progressText(m.id)` when practice exists, else old `best_`), `index.html` (script tag after practice-core), `assets/css/style.css` (`.px-*` rules), `assets/css/tailwind.css` only if new Tailwind classes are used (`npm run build:css`).

**Interfaces:**
- Consumes: `PracticeCore`, `PRACTICE[id]`, `store`, `typeset`, `MODS`.
- Produces: global `PracticeUI = { render(tv, m), progressText(id) → string, enhanceWorked(root) }` (`enhanceWorked` is implemented in Task 4; Task 3 exports a no-op stub).

- [ ] **Step 1: Write failing browser tests** in `tests/e2e/test_practice_ui.py` (harness `open_page('mech-quiz')`):
  - `test_level_map`: 3 rows with labels `ระดับ 1 · เข้าใจแนวคิด`, `ระดับ 2 · คำนวณ`, `ระดับ 3 · โจทย์ประยุกต์`, dot counts 7/7/6, row 1 marked `แนะนำ` on empty progress, no page errors.
  - `test_mcq_why`: start level 1, pick a wrong option → feedback shows that option's `why` and the item's `e`; record for that id is `wrong`.
  - `test_numeric_flow`: level 2 item — type the mistake value → shows its `msg`, status unchanged; type `'abc'` → `อ่านตัวเลขไม่ออก` and tries not counted; type the right answer (read from `PracticeUI` debug hook `window.__px.current().answer`) → `ถูกต้อง`, record `ok`.
  - `test_hints_and_solution`: level 3 — `คำใบ้ 1/n` reveals one hint per click; `ดูวิธีทำ` before correct → input disabled until leaving the item, record `wrong`.
  - `test_new_numbers`: level 2 after correct → `ตัวเลขชุดใหม่` changes the question text; answering the new set correctly keeps `ok`.
  - `test_rapid_new_numbers`: click `ตัวเลขชุดใหม่` 5× within 300 ms, wait 1.5 s → `__px.current()` vars match the numbers visible in `.px-q` and `.px-solution` (after opening it).
  - `test_progress_persists`: answer 2 items, reload → dots and counts unchanged; `ทำข้อที่ยังผิด (n)` lists exactly the wrong ids; `ล้างความคืบหน้าบทนี้` after confirm empties it.
  - `test_corrupt_progress`: init script sets `localStorage.einstein_practice_mech = '{"bad":1}'` (and separately `'not json'`) → map renders with all-grey dots, no page errors.
  - `test_input_mode`: an item whose answer is negative or sci has `inputmode="text"` and helper `พิมพ์แบบ 2.1e-2 ได้`; a plain positive item has `inputmode="decimal"`.
  - `test_old_route_and_mobile`: `#mech-quiz` opens the map; at 390×844 no horizontal scroll; dark theme renders (`html.dark`) without errors.
  - `test_other_chapters_fallback`: `#atom-quiz` (no practice file yet) still shows the old quiz.
  Run `python3 tests/e2e/test_practice_ui.py` — Expected: FAIL (`PracticeUI` undefined).

- [ ] **Step 2: Implement `assets/js/practice/practice-ui.js`.** Item runner order inside a level = data order; "redo" set = wrong ids in data order. Rendering of each item gets a monotonically increasing token; any async callback (typeset, timers) checks the token before writing (Review Focus 5). Expose `window.__px = { current() }` for tests. Visuals follow the existing `.qcard/.opt/.fb` styles and the chapter accent `m.acc`; numbers in `.mono`.

- [ ] **Step 3: Run** `python3 tests/e2e/test_practice_ui.py` and `node --test tests/*.test.js` — Expected: all PASS, `errors: none`.

- [ ] **Step 4: Commit** `feat(practice): level map, item runner and local progress`.

---

### Task 4: Worked-example stepper + mechanics examples

**Files:**
- Modify: `assets/js/practice/practice-ui.js` (`enhanceWorked`), `assets/js/app.js` (`renderLecture` calls `PracticeUI.enhanceWorked(art)` before `typeset(art)`), `index.html` (`lec-mech`: convert its 2 `<details class="ex">` and add examples so each of `s1`–`s6` has ≥ 1), `assets/css/style.css` (`.wx*`), `tests/e2e/test_practice_ui.py`, `tests/practice-content.test.js`

**Interfaces:**
- Markup contract (static HTML inside lecture templates):
  `<div class="wx"><div class="wx-q">…question…</div><ol class="wx-steps"><li>…</li>…≥2…</ol></div>`
- `enhanceWorked(root)` hides all steps, adds `ลองคิดเองก่อน แล้วค่อยเปิดทีละขั้น`, a button `ดูขั้นต่อไป`, and a counter `ขั้น k/n` (`.mono`); the button disappears after the last step.

- [ ] **Step 1: Write failing tests:** Node `worked coverage` (in `practice-content.test.js`): for each chapter that has a practice file, every `<h2>` section of its lecture template contains ≥ 1 `.wx` with ≥ 2 `<li>`, and the template has no `details.ex` left. Browser `test_worked_stepper`: on `#mech`, the first `.wx` shows 0 steps, each click reveals exactly one more, counter reads `ขั้น 2/n` after two clicks, button gone at the end. Run both — Expected: FAIL.
- [ ] **Step 2: Implement `enhanceWorked`, CSS, and the mechanics examples** (content-review note lines appended to `docs/superpowers/content-review/mech.md`).
- [ ] **Step 3: Run** `node --test tests/*.test.js` and `python3 tests/e2e/test_practice_ui.py` — Expected: all PASS.
- [ ] **Step 4: Commit** `feat(practice): step-by-step worked examples; mechanics examples`.
- [ ] **Step 5: Preview for the owner (does not block):** push branch `practice-ladder`, open a **draft** PR via `gh api repos/Jap-SAt/einstein-physics/pulls -f draft=true …`, take screenshots (level map, L2 item with a mistake message, L3 hint, worked example; desktop + 390 px) into `/mnt/user-data/outputs/practice-preview/`, send them to the owner with the PR link, and continue with Task 5.

---

### Tasks 5–10: Remaining chapters (one task each)

Order: **Task 5 thermo, Task 6 waves, Task 7 particle, Task 8 em, Task 9 atom, Task 10 nuclear.**

**Files (per chapter `<id>`):**
- Create: `assets/js/data/practice/<id>.js`, `tests/practice-ref/compute_<id>.py`, `tests/practice-ref/<id>.json`, `docs/superpowers/content-review/<id>.md`
- Modify: `index.html` (script tag; `lec-<id>`: convert `details.ex`, add `.wx` so every `<h2>` has ≥ 1)

**Interfaces:** Consumes the Task 2 item schema and the Task 4 `.wx` markup contract; no new code.

- [ ] **Step 1: Run** `node --test tests/*.test.js` after adding only the script tag and an empty `PRACTICE.<id> = []` — Expected: FAIL on `counts`/`coverage`/`worked coverage` for `<id>`.
- [ ] **Step 2: Write the 20 items** (revise that chapter's existing `QUIZ.<id>` items into the set), the worked examples, and the review notes.
- [ ] **Step 3: Write and run** `python3 tests/practice-ref/compute_<id>.py > tests/practice-ref/<id>.json`.
- [ ] **Step 4: Run** `node --test tests/*.test.js` and `python3 tests/e2e/test_practice_ui.py` — Expected: all PASS.
- [ ] **Step 5: Commit** `feat(practice): <chapter title in English> practice set and worked examples`.

---

### Task 11: Retire the old quiz, docs, final check

**Files:**
- Delete: `assets/js/data/quiz.js`
- Modify: `index.html` (remove its script tag), `assets/js/app.js` (remove `renderQuiz`, the fallback branch and `best_` reads), `tests/e2e/test_practice_ui.py` (replace `test_other_chapters_fallback` with `test_all_chapters_have_practice`: each `#<id>-quiz` shows the map with 7/7/6 dots), `README.md` (section แบบฝึกหัด: levels, typed answers & accepted formats, progress stored per browser, how to add an item + run reference/validator), `package.json` (`"test": "node --test tests/*.test.js"`)

- [ ] **Step 1: Write the failing test** `test_all_chapters_have_practice`; Node test `no QUIZ global`: `index.html` has no `data/quiz.js`. Run — Expected: FAIL.
- [ ] **Step 2: Remove the old quiz and update docs.**
- [ ] **Step 3: Run the full suite:** `npm test` and `for f in tests/e2e/test_*.py; do python3 $f || exit 1; done` — Expected: all PASS, `errors: none` (cosmos tests included).
- [ ] **Step 4: Commit** `refactor(practice): retire old quiz; docs`.
- [ ] **Step 5: Mark the PR ready for review** (`POST /repos/Jap-SAt/einstein-physics/pulls/{n}/ccr/ready_for_review`) after the final whole-branch review and its fixes.
