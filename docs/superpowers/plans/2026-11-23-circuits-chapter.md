# Circuits Chapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add chapter 05 "ไฟฟ้ากระแสและวงจร" (`circuit`) — lecture with worked examples, a 3D circuit lab simulation with prebuilt scenes, and a 20-item practice set — and renumber the later chapters without breaking links or learner progress.

**Architecture:** A pure module (`Circuit`, Node + browser) solves the six prebuilt scenes (modified nodal analysis on a tiny topology) and the RC closed-form; the simulation (`simCircuit`) draws wires whose height above the floor is the potential, with charge markers flowing in proportion to the solved currents. The chapter plugs into the existing MODS/SIMS/template/practice systems exactly as `estat` did.

**Tech Stack:** Classic scripts, Three.js r147 (vendored), MathJax 3.2.2, `assets/css/style.css`, Node `node:test`, Python 3 references, Playwright (`tests/e2e/harness.py`).

**Spec:** `docs/superpowers/specs/2026-11-23-circuits-chapter-design.md` (builds on `2026-11-21-electrostatics-chapter-design.md`; the previous plan `docs/superpowers/plans/2026-11-21-electrostatics-chapter.md` is the pattern to follow)

## Global Constraints

- Chapter `{ id: 'circuit', no: '05', group: 'classic', short: 'ไฟฟ้ากระแส', en: 'Current Electricity', title: 'ไฟฟ้ากระแสและวงจร', sub: 'กระแส · กฎของโอห์ม · อนุกรมและขนาน · เคอร์ชอฟฟ์ · วงจร RC' }` after `estat`; `no` becomes particle 06, em 07, atom 08, nuclear 09; ids unchanged; **particle stays in group `modern`** (it moves to `classic` in the later magnetism chapter).
- New accent variables `--a9` / `--a9s`, light and dark themes (all eight slots are used); contrast AA like `--a8`.
- Lecture `<template id="lec-circuit">` with `<h2 id="s1">`…`s5`: กระแสไฟฟ้าและแรงเคลื่อนไฟฟ้า / ความต้านทานและกฎของโอห์ม / วงจรอนุกรมและขนาน / กฎของเคอร์ชอฟฟ์ / กำลังไฟฟ้าและวงจร RC — content and misconceptions per spec §6.2 table; ≥ 1 `.wx` per section; no magnetism or induction.
- Current is conventional (positive charge direction) throughout; the lecture says where electrons go the other way. Terms used identically everywhere: แรงเคลื่อนไฟฟ้า (ε), ความต่างศักย์ระหว่างขั้ว (V), ความต้านทานภายใน (r).
- Constants: e = 1.6×10⁻¹⁹ C; stated in every question/example that uses it. Resistivity only when the question gives it.
- RC time constant: charging τ = (R + r)C (battery's r is in the loop); discharging through R alone τ = RC; ideal capacitor. Simulation, lecture and items use the same τ.
- Simulation per spec §6.3 (approach ข, prebuilt scenes): single / series / parallel / mixed (R₁ in series with R₂∥R₃) / two-loop two-battery / RC with switch and C slider; wire height = potential; charge markers' flow ∝ solved current, split at junctions in the solved ratio; resistor glow ∝ P = I²R; slider r has a non-zero minimum (no infinite current); only ohmic resistors; readouts I, V across, P in `.mono`; also R_total, I_total, terminal V (≠ ε when r > 0); Thai note that markers are qualitative (real drift speed is far slower); ≥ 30 fps on mobile; `dispose()` frees everything.
- Practice: `PRACTICE.circuit`, 20 items 7/7/6 under the existing schema and validator; `signed: true` where a current or voltage can come out negative; review notes `docs/superpowers/content-review/circuit.md`; Python reference `tests/practice-ref/compute_circuit.py` → `circuit.json`.
- Thai copy; never Thai inside MathJax `\text{}`; changing numbers `.mono`; file:// works; light + dark; usable at 390 px (lecture with every `.wx` open must not overflow).
- Content method: Feynman (learner view) → expert check → fix, for lecture, examples and items. Analogies (water, hills) must state where they stop working.
- Existing suites stay green: `npm test` and every `tests/e2e/test_*.py`. Work on branch `circuit`.

## Review Focus

1. Sliders at their extremes (smallest r, R₁ ≪ R₂, C minimum, ε maximum) → every readout, marker speed and wire height stays finite; no `NaN`/`Infinity` in the panel or the scene. (Task 1 `extreme values stay finite`; Task 3 `test_extreme_sliders`.)
2. Two-loop scene where a battery is being charged → its current is negative in the readout with a reversed marker flow, not shown as 0 or as an absolute value. (Task 1 `twoloop sign`; Task 3 `test_twoloop_reversed_current`.)
3. Changing ε, R, r or C while the RC scene is running → the run restarts from t = 0 with the new τ (stated in the note); the displayed q matches the formula at the displayed t. (Task 3 `test_rc_restart_on_change`.)
4. Switching scenes rapidly, or leaving the page during the RC animation → no leaked canvases, timers or listeners; no errors afterwards. (Task 3 `test_scene_switch_and_leave`.)
5. Learner drags a slider to make one branch's current tiny (R₂ = 1 kΩ vs R₃ = 1 Ω in parallel) → the thin branch still shows a visible, correctly proportioned (not zero) marker flow. (Task 3 `test_junction_ratio`.)

---

### Task 1: Circuit physics module (`Circuit`)

**Files:**
- Create: `assets/js/sims/circuit-core.js`
- Test: `tests/circuit-core.test.js`

**Interfaces:**
- Produces global `Circuit` (+ `module.exports`). SI units (V, A, Ω, F, s).
  - `SCENES = ['single','series','parallel','mixed','twoloop','rc']`
  - `R_INTERNAL_MIN = 0.05` (Ω; the slider minimum for r)
  - `defaults(sceneId) → params` — `{ eps, r, R1, R2, R3, eps2, C }` (fields a scene does not use are ignored)
  - `build(sceneId, p) → { nodes: number, ground: 0, elems: [{ id, kind: 'emf'|'res'|'cap', a, b, value }] }` — topology per spec §6.3: series = R₁,R₂,R₃ in one loop; parallel = R₁∥R₂∥R₃; mixed = R₁ then (R₂∥R₃); twoloop = left branch (ε, r, R₁), middle R₃, right branch (ε₂, r, R₂) between top and bottom nodes; `rc` = ε, r, R, C (uses `R1` as R) in one loop. The battery's r is returned as a separate `res` element `r`.
  - `solve(sceneId, p) → { v: number[] (node potentials, node 0 = 0 V), elems: { [id]: { I, V, P } } (I positive from a to b, V = v[a] − v[b], P = I²·value for resistors), Rtotal, Itotal, Vterm, Ptotal }` — for `rc` this is the instantaneous state at t = 0 (empty capacitor)
  - `tau(p, mode: 'charge'|'discharge') → number` — `(R1 + r)·C` or `R1·C`
  - `rcState(p, mode, t, v0 = p.eps) → { q, vC, i }` — charge: `q = C·eps·(1 − e^(−t/τ))`, `i = (eps − vC)/(R1 + r)`; discharge from `v0`: `q = C·v0·e^(−t/τ)`, `i = −vC/R1`

- [ ] **Step 1: Write failing tests** `tests/circuit-core.test.js` (relative tolerance 1e-9 unless stated):
  - `series total`: R = 2, 4, 6 Ω, ε = 12 V, r = 0.5 Ω → `Rtotal` = 12.5, I = 0.96 A in all three, V across each = I·R, `Vterm` = 12 − 0.96·0.5.
  - `parallel total`: R = 6, 3, 2 Ω, r = 0.5 → equivalent 1 Ω, `Itotal` = 8 A, V across each = 8 V, branch currents 4/3, 8/3, 4 A.
  - `mixed`: R₁ = 4, R₂ = 6, R₃ = 3, ε = 12, r = 0.5 → `Rtotal` = 6 (external, excluding r), `Itotal` = 12/6.5, the currents in R₂ and R₃ are in ratio 1:2 and sum to the current through R₁.
  - `KCL and KVL hold in every scene`: for each non-rc scene with default params and 20 seeded random parameter sets, the sum of currents leaving each node is < 1e-9·scale, and the sum of voltage differences around every elementary loop is < 1e-9·scale.
  - `power balance`: Σ P over resistors (including r) = ε·I for single-source scenes; for twoloop Σ P = Σ ε_k·I_k.
  - `terminal voltage`: `Vterm` = ε − I·r when r > 0.
  - `twoloop symmetric`: ε = ε₂ = 12 V, r = 0.5, R₁ = R₂ = 2, R₃ = 4 → branch current 12/10.5, current in R₃ = 2·12/10.5.
  - `twoloop sign`: ε₂ = 3 V ≪ ε = 12 V (R₁ = R₂ = 2, R₃ = 4, r = 0.5) → the ε₂ element's `I` is negative (being charged), KCL still holds.
  - `rc`: τ = (R + r)C = 2.5·1e-3 s for R = 2, r = 0.5, C = 1 mF; at t = τ charging q/(Cε) = 1 − 1/e and discharging q/(Cv₀) = 1/e (within 1e-9); at t = 0 charge q = 0, i = ε/(R + r); at t = 20τ within 1e-8 of final; `tau(...,'discharge')` = R·C.
  - `extreme values stay finite`: `R1` = 1e-3 vs `R2` = 1e6 in parallel/mixed, r = `R_INTERNAL_MIN` → all outputs finite.
- [ ] **Step 2: Run** `node --test tests/*.test.js` — Expected: circuit tests FAIL (`Cannot find module`).
- [ ] **Step 3: Implement** `assets/js/sims/circuit-core.js` per the interface (Gaussian elimination with partial pivoting over node equations; capacitors are open circuits in `solve`; fixed seeded RNG only in tests).
- [ ] **Step 4: Run** `node --test tests/*.test.js` — Expected: all PASS.
- [ ] **Step 5: Commit** `feat(circuit): circuit physics module`.

---

### Task 2: Register the chapter, renumber, accent, lecture skeleton

**Files:**
- Modify: `assets/js/data/modules.js` (ICONS.circuit, MODS entry, renumber), `assets/css/style.css` (`--a9`/`--a9s` in both themes; any rule listing `--a1`…`--a8`), `index.html` (`<template id="lec-circuit">` with five `<h2 id="s1…s5">` and a placeholder paragraph each; script tags for `circuit-core.js` and `sims/circuit.js`), `assets/js/app.js` (SIMS `circuit: () => simCircuit`; home intro paragraph mentions ไฟฟ้ากระแส), `README.md` ("8 บท" → "9 บท", chapter list), `tests/e2e/test_estat.py` (`test_home_order` and the `range(1, 9)` numbering assert → 9 chapters, `circuit` between `estat` and `particle`)
- Create: `assets/js/sims/circuit.js` (stub `simCircuit(host, U) → { toggle(), dispose() }`), `tests/e2e/test_circuit.py`

**Interfaces:**
- Consumes: the guards for chapters without practice data (already in `app.js`/`practice-ui.js` from the estat work).
- Produces: routes `#circuit`, `#circuit-sim`, `#circuit-quiz`; `MODS` order mech, thermo, waves, estat, circuit, particle, em, atom, nuclear; `simCircuit(host, U) → { toggle(): boolean, dispose(): void }`.

- [ ] **Step 1: Write failing browser tests** in `tests/e2e/test_circuit.py` (harness `open_page`):
  - `test_home_order`: hrefs = `#mech #thermo #waves #estat #circuit #particle #em #atom #nuclear`; numbers `01`…`09`; circuit is `05` `ไฟฟ้ากระแสและวงจร`; particle `06`, nuclear `09`; particle is still in the `modern` group and circuit in `classic`.
  - `test_old_links_and_progress`: same pattern as `test_estat.test_old_links_and_progress` for `#particle` and `#estat-quiz` (progress record survives the renumbering).
  - `test_circuit_tabs`: `#circuit` shows five h2 with ids s1–s5; `#circuit-sim` mounts a canvas without page errors; `#circuit-quiz` shows `แบบฝึกหัดบทนี้กำลังจัดทำ`.
  - `test_no_hardcoded_count`: neither `index.html` nor the rendered home text contains `8 บท`.
  Run `python3 tests/e2e/test_circuit.py` and `python3 tests/e2e/test_estat.py` — Expected: FAIL.
- [ ] **Step 2: Implement** the registration, icon (stroke SVG, same style as `ICONS`), accent, skeleton, stub, README. Search code, tests and copy for hard-coded chapter numbers/counts (`บทที่ 0N`, `0%d`, `range(1, 9)`) and derive from `MODS` or update.
- [ ] **Step 3: Run** both e2e files, `python3 tests/e2e/test_practice_ui.py`, `npm test` — Expected: all PASS.
- [ ] **Step 4: Commit** `feat(circuit): register chapter 05, renumber, accent a9`.

---

### Task 3: Circuit lab simulation

**Files:**
- Modify: `assets/js/sims/circuit.js`, `assets/css/style.css` (panel styles only if needed)
- Test: `tests/e2e/test_circuit.py`

**Interfaces:**
- Consumes: `Circuit.defaults/solve/tau/rcState/R_INTERNAL_MIN`, `makeHost` (`host.scene/camera/controls/world/renderer`, `setHome`, `onUpdate`), `makeUI` (`head/group/note/slider/seg/check/readouts/html`), `isDark()`, `themechange`.
- Produces: `simCircuit(host, U) → { toggle(), dispose() }` and debug hook `window.__ck = { scene(id), setParam(name, value), readout(elemId) → { I, V, P }, summary() → { Rtotal, Itotal, Vterm }, markerSpeed(elemId) → number, wireHeight(nodeId) → number, rc(): { t, q, vC }, switchTo('charge'|'discharge'), params() }`.

- [ ] **Step 1: Write failing browser tests** (open `#circuit-sim`):
  - `test_scenes_match_solver`: for each of the six scenes, `__ck.readout(e)` for every element equals `Circuit.solve` within 0.5 %; `summary()` likewise; no page errors.
  - `test_wire_height_is_potential`: mixed scene → `wireHeight(n)` is proportional to `solve().v[n]` (same factor for all nodes, ratio within 0.5 %); the battery's + node is the highest.
  - `test_junction_ratio` (Review 5): parallel scene with R₂ = 1000 Ω, R₃ = 1 Ω → `markerSpeed` of the two branches in ratio I₂ : I₃ within 5 %, and the thin branch speed > 0.
  - `test_extreme_sliders` (Review 1): set each slider to min then max in every scene → no `NaN`/`Infinity` text in the panel, `markerSpeed` and `wireHeight` finite, no errors.
  - `test_twoloop_reversed_current` (Review 2): twoloop with ε₂ = 3, ε = 12 → readout `I` of the second battery < 0 and its panel text shows a minus sign; `markerSpeed` there is signed (reversed).
  - `test_rc_curve`: rc scene, charging; advance the simulation clock to t = τ (test hook sets time) → `rc().q` within 0.5 % of `Cε(1 − 1/e)`; discharge from full → 1/e at t = τ; the on-screen τ equals `(R + r)C` when charging and `RC` when discharging.
  - `test_rc_restart_on_change` (Review 3): change C mid-run → `rc().t` resets to 0 and the note states the restart.
  - `test_scene_switch_and_leave` (Review 4): switch scenes 20 times quickly, then `location.hash = '#circuit'` → one canvas at most, no errors after 500 ms; `#circuit-sim` works again.
  - `test_theme_switch`, `test_mobile_layout` (390×844: no horizontal overflow, controls reachable), `test_fps_drag` (smoke: ≥ 10 rendered frames while moving a slider for 1 s in headless).
  Run — Expected: FAIL.
- [ ] **Step 2: Implement** `simCircuit` per spec §6.3: one `buildScene(id)` that lays wires on the floor (x, z) with y = k·potential (scale chosen so ε at its maximum fits the view), resistor boxes with glow ∝ P, battery with ε and r labels, markers as instanced points moving along each wire at speed ∝ solved current (signed; capped), rebuilt only when scene or a slider changes; panel sections: scene `seg`, sliders (ε, R₁–R₃, r ≥ `R_INTERNAL_MIN`, ε₂ in twoloop, C and the charge/discharge switch in rc), checks (markers, height view), readouts (R_total, I_total, terminal V, and the picked element's I, V, P in `.mono`; element picked by pointer, default the first resistor), the Thai qualitative note; RC run advances with a time-scale so τ takes about 3 s on screen, resets on any parameter change; `dispose()` frees geometries, materials, textures, timers and listeners.
- [ ] **Step 3: Run** `python3 tests/e2e/test_circuit.py` and `npm test` — Expected: all PASS, `errors: none`. Review screenshots (desktop mixed + rc, 390 px, dark) and fix anything unreadable.
- [ ] **Step 4: Commit** `feat(circuit): circuit lab simulation`.

---

### Task 4: Lecture content and worked examples

**Files:**
- Modify: `index.html` (`lec-circuit` full content, ≥ 1 `.wx` per section)
- Create: `docs/superpowers/content-review/circuit.md` (lecture + examples part)
- Test: `tests/e2e/test_circuit.py`

**Interfaces:** Consumes the `.wx` markup contract `<div class="wx"><div class="wx-q">…</div><ol class="wx-steps"><li>…</li>…≥2…</ol></div>` and the lecture conventions (lead, misconception boxes, formula box `sumbox`, end cards) of the other templates.

- [ ] **Step 1: Write failing tests**: e2e `test_lecture_content` — five sections each with ≥ 1 `.wx` (≥ 2 `<li>`); no `\text{` containing Thai; at 390×844 after opening every `.wx` the page is not wider than 390 px; text contains `V = \varepsilon - Ir`, `\tau = RC` and `P = V^2/R` (or the form the lecture uses for each — assert the three concepts by their MathJax source); each misconception named in spec §6.2 appears in some box (grep by a short Thai key phrase per row). Run — Expected: FAIL.
- [ ] **Step 2: Write** the lecture per spec §6.2: s1 current/emf/internal resistance, s2 Ohm and R = ρL/A, s3 series/parallel with the capacitor contrast, s4 Kirchhoff with the sign procedure, s5 power and RC (solution quoted, not derived; read-off at t = τ); link back to estat s4 and s5, forward to nuclear s3 only if that anchor exists (check before adding); verify every example's arithmetic in Python; one review line per section and per example in `circuit.md`; analogies state their limits.
- [ ] **Step 3: Run** e2e + `npm test` — Expected: PASS.
- [ ] **Step 4: Commit** `feat(circuit): lecture and worked examples`.
- [ ] **Step 5 (controller, does not block):** push `circuit`, open a draft PR, send the owner screenshots (mixed scene, RC at τ, a lecture section with an opened example, 390 px), continue with Task 5.

---

### Task 5: Practice set (20 items)

**Files:**
- Create: `assets/js/data/practice/circuit.js`, `tests/practice-ref/compute_circuit.py`, `tests/practice-ref/circuit.json`
- Modify: `index.html` (script tag after `estat.js`), `docs/superpowers/content-review/circuit.md` (items part)

**Interfaces:** Consumes the item schema and validator used by the other chapters (`tests/practice-content.test.js`) and `PracticeCore`; items follow `assets/js/data/practice/estat.js` as the model.

- [ ] **Step 1: Run** `npm test` after adding only the script tag and `PRACTICE.circuit = []` — Expected: FAIL on counts / coverage / reference / worked coverage.
- [ ] **Step 2: Write** 20 items (7/7/6): L1+L2 cover s1–s5, L3 mixes ≥ 2 sections each, from the spec §6.4 list (mixed circuit current and power, battery with r, two-loop Kirchhoff, RC time to a given percentage, capacitor series/parallel inside RC, electricity cost); misconceptions of spec §6.2 drive L1 distractors and mistake messages; `signed: true` on items whose current or voltage can be negative; constants and τ convention stated in the question.
- [ ] **Step 3: Write and run** `python3 tests/practice-ref/compute_circuit.py > tests/practice-ref/circuit.json`, using a different route from the JS where possible (e.g. node-voltage vs Kirchhoff loops, energy vs ratio for RC).
- [ ] **Step 4: Run** `npm test` and `python3 tests/e2e/test_practice_ui.py` — Expected: all PASS (circuit shows 7/7/6).
- [ ] **Step 5: Commit** `feat(circuit): practice set`.

---

### Task 6: Cross-links, docs, final check

**Files:**
- Modify: `index.html` (`lec-estat` s5 end: link to circuit s5 (RC) and s3; `lec-circuit` links already present from Task 4), `README.md` (chapter list, file tree with `sims/circuit.js`, `sims/circuit-core.js`, `data/practice/circuit.js`, test commands), `tests/e2e/test_circuit.py`

- [ ] **Step 1: Write failing test** `test_cross_links`: from `lec-estat` s5 the link lands on `#circuit` with `s5` in view; from `lec-circuit` s1 the link lands on `#estat` with `s4` in view (same `#<id>?s=<section>` mechanism as the estat cross-links). Run — Expected: FAIL.
- [ ] **Step 2: Implement** the links and README updates; reread every `บทที่ 0N` reference in `index.html` for stale numbers after the renumbering.
- [ ] **Step 3: Run the full suite** `npm test` and `for f in tests/e2e/test_*.py; do python3 $f || exit 1; done` — Expected: all PASS, `errors: none`.
- [ ] **Step 4: Commit** `feat(circuit): cross-links; docs`.
- [ ] **Step 5 (finish stage, after the final whole-branch review):** mark the PR ready for review.
