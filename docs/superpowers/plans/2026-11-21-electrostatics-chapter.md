# Electrostatics Chapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add chapter 04 "ไฟฟ้าสถิต" (`estat`) — lecture with worked examples, a 3D electric-field lab simulation, and a 20-item practice set — and renumber the later chapters, without breaking existing links or learner progress.

**Architecture:** A pure physics module (`EField`, Node + browser) computes E, V and field-line traces; the simulation (`simEField`) renders traced lines in Three.js and a potential floor whose colours are computed per pixel in a fragment shader from the same formula. The chapter plugs into the existing MODS/SIMS/template/practice systems; small guards make a chapter without practice data safe.

**Tech Stack:** Classic scripts, Three.js r147 (vendored, ShaderMaterial), MathJax 3.2.2, `assets/css/style.css` (+ Tailwind prebuilt only if new classes), Node 22 `node:test`, Python 3 references, Playwright (`tests/e2e/harness.py`).

**Spec:** `docs/superpowers/specs/2026-11-21-electrostatics-chapter-design.md`

## Global Constraints

- Chapter `{ id: 'estat', no: '04', group: 'classic', short: 'ไฟฟ้าสถิต', en: 'Electrostatics', title: 'ไฟฟ้าสถิต', sub: 'ประจุ · กฎของคูลอมบ์ · สนามและศักย์ · ตัวเก็บประจุ' }` after `waves`; `no` becomes particle 05, em 06, atom 07, nuclear 08; ids unchanged.
- New accent CSS variables `--a8` / `--a8s` in light and dark themes (all 7 existing slots are used).
- Constants: k = 9.0×10⁹ N·m²/C², e = 1.6×10⁻¹⁹ C, mₑ = 9.11×10⁻³¹ kg, mₚ = 1.67×10⁻²⁷ kg, ε₀ = 8.85×10⁻¹² C²/(N·m²); stated in every question/example that uses them.
- Lecture `<template id="lec-estat">` with `<h2 id="s1">`…`s5`: ประจุไฟฟ้า / กฎของคูลอมบ์ / สนามไฟฟ้า / ศักย์และความต่างศักย์ / ตัวเก็บประจุ — content and misconceptions per spec §6.2 table; ≥ 1 `.wx` per section; no current-electricity or magnetism knowledge assumed.
- Simulation per spec §6.3: charges on plane y = 0 (positive red, negative blue as in the particle sim), traced 3D field lines with arrowheads (start at +, end at −; density ∝ |q|), shader potential floor (warm +, cool −, neutral 0, contour lines, clamped near charges, theme-aware), ≤ 8 charges, place/drag/select/adjust q (−5 … +5 µC), presets dipole / +,+ / parallel plates, damped test charge with a Thai note that it is a qualitative analogy, readout |E| (N/C), E direction arrow, V (V) at pointer in `.mono`, scene scale stated in the panel (1 scene unit = 1 cm), ≥ 30 fps while dragging on mobile, `dispose()` frees everything.
- Practice: `PRACTICE.estat`, 20 items 7/7/6 under the existing schema and validator; `signed: true` where sign matters; review notes `docs/superpowers/content-review/estat.md`; Python reference `tests/practice-ref/compute_estat.py` → `estat.json`.
- Thai copy; never Thai inside MathJax `\text{}`; changing numbers `.mono`; file:// works; light + dark; usable at 390 px (lecture with all `.wx` open must not overflow).
- Content method: Feynman (learner view) → expert check → fix, for lecture, examples and items.
- Existing suites stay green: `npm test` and every `tests/e2e/test_*.py` (cosmos included).

## Review Focus

1. A pointer, test charge or field-line step exactly at (or extremely near) a charge → no NaN/Infinity in readouts, lines or shader; readout shows a clamped value or "—". (Task 1 test `field at a charge is finite`; Task 3 test `test_readout_at_charge`.)
2. Only negative charges, a single charge, or no charges → lines seeded and drawn correctly (traced backward from negatives) or the scene is empty without errors. (Task 1 test `trace with only negatives`; Task 3 test `test_clear_and_negative_only`.)
3. Learner keeps clicking to add a 9th charge → refused with a Thai message, nothing breaks. (Task 3 test `test_charge_cap`.)
4. Theme switched while the simulation is open → floor and line colours follow the theme; no duplicated scenes. (Task 3 test `test_theme_switch`.)
5. Route change in the middle of dragging a charge → listeners removed, no errors afterwards. (Task 3 test `test_leave_mid_drag`.)

---

### Task 1: Field physics module (`EField`)

**Files:**
- Create: `assets/js/sims/efield-core.js`
- Test: `tests/efield-core.test.js`

**Interfaces:**
- Produces global `EField` (+ `module.exports`). Units: positions in scene units (1 unit = 1 cm = 0.01 m), charges in µC, outputs SI.
  - `K = 9.0e9`
  - `field(charges: [{x, y, z, q}], p: {x, y, z}) → {x, y, z, mag}` (N/C; within `R_MIN = 0.3` units of a charge the distance is clamped to `R_MIN`, so always finite)
  - `potential(charges, p) → number` (V; same clamp)
  - `traceLines(charges, { perUnitCharge = 8, maxSteps = 600, step = 0.25, bound = 40 }) → [{ points: Float32Array, from: index, to: index | -1 }]` — RK4 along +E from seeds on a sphere of radius `R_MIN·1.2` around each positive charge (count = round(perUnitCharge·|q|)); if there are no positive charges, seed around negatives and trace along −E; stop when within `R_MIN` of a charge of opposite sign (record `to`), outside `bound`, or after `maxSteps`
  - `isWithin(p, charges, r) → boolean`

- [ ] **Step 1: Write failing tests** `tests/efield-core.test.js`:
  - `point charge E`: one +1 µC charge at origin, p at (10,0,0) (0.1 m) → `mag` = 9.0e9·1e-6/0.01 = 9.0e5 within 0.1 %, direction +x.
  - `point charge V`: same → V = 9.0e4 within 0.1 %.
  - `superposition zero`: +1 µC at (−5,0,0) and (+5,0,0) → `mag` at origin < 1e-6·(single-charge value).
  - `E = −grad V`: dipole ±2 µC at (∓4,0,0); at 5 random points (seeded) compare `field` with central differences of `potential` (h = 0.01 units, convert units) within 1 %.
  - `field at a charge is finite`: p exactly at a charge → finite `mag` and finite `potential`.
  - `dipole lines start at + and end at −`: every traced line has `from` = positive index; ≥ 80 % of lines have `to` = the negative index; all points finite.
  - `trace with only negatives`: single −1 µC → lines exist, seeded around the charge and traced along −E; assert the distance from the charge increases monotonically along each line and every point is finite.
  - `line count ∝ |q|`: +3 µC alone yields 3× the lines of +1 µC (±1).
  - `no charges`: `traceLines([])` → `[]`.
- [ ] **Step 2: Run** `node --test tests/*.test.js` — Expected: efield tests FAIL (`Cannot find module`).
- [ ] **Step 3: Implement** `assets/js/sims/efield-core.js` per the interface.
- [ ] **Step 4: Run** `node --test tests/*.test.js` — Expected: all PASS.
- [ ] **Step 5: Commit** `feat(estat): electric field physics module`.

---

### Task 2: Register the chapter, renumber, guards, lecture skeleton

**Files:**
- Modify: `assets/js/data/modules.js` (ICONS.estat, MODS entry, renumber), `assets/css/style.css` (`--a8`/`--a8s` both themes + any chapter-accent mapping rules that list `--a1`…`--a7`), `index.html` (`<template id="lec-estat">` with five `<h2 id="s1…s5">` headings and one placeholder paragraph each; script tags for `efield-core.js` and `sims/efield.js` placeholder), `assets/js/app.js` (SIMS `estat: () => simEField`; guard: lecture next-card and home badge when `PRACTICE[id]` is missing or empty), `assets/js/practice/practice-ui.js` (`render` shows `แบบฝึกหัดบทนี้กำลังจัดทำ` when practice data is missing or empty instead of throwing)
- Create: `assets/js/sims/efield.js` with a minimal `simEField(host, U)` returning `{ toggle(), dispose() }` (empty scene + panel title) — Task 3 fills it
- Test: `tests/e2e/test_estat.py`

**Interfaces:**
- Consumes: `EField` (loaded, unused until Task 3).
- Produces: route `#estat`, `#estat-sim`, `#estat-quiz`; `MODS` order mech, thermo, waves, estat, particle, em, atom, nuclear; `simEField(host, U) → { toggle(): boolean, dispose(): void }`.

- [ ] **Step 1: Write failing browser tests** in `tests/e2e/test_estat.py` (harness `open_page`):
  - `test_home_order`: home lists chapter cards in MODS order with numbers 01…08; the card after คลื่นและแสง reads `04` `ไฟฟ้าสถิต`; อนุภาค reads `05`.
  - `test_old_links_and_progress`: init script sets `localStorage.einstein_practice_particle` to a record with one `ok` item; `#particle` opens the particle lecture; `#particle-quiz` shows that item green.
  - `test_estat_tabs`: `#estat` shows five h2 with ids s1–s5; `#estat-sim` mounts a canvas without page errors; `#estat-quiz` shows `แบบฝึกหัดบทนี้กำลังจัดทำ` and no page errors.
  - `test_no_hardcoded_count`: page text contains no `7 บท` (grep the rendered home text and `index.html`).
  Run `python3 tests/e2e/test_estat.py` — Expected: FAIL.
- [ ] **Step 2: Implement** the registration, accent, icon (stroke SVG in the same style as ICONS), skeleton template, stub sim, guards. Search code and copy for hard-coded chapter counts or numbers and derive them from MODS.
- [ ] **Step 3: Run** `python3 tests/e2e/test_estat.py`, `python3 tests/e2e/test_practice_ui.py`, `npm test` — Expected: all PASS (the practice validator must not require practice data for `estat` yet; if it iterates MODS, it must only check chapters that have a data file, as it does today).
- [ ] **Step 4: Commit** `feat(estat): register chapter 04, renumber, guards for chapters without practice`.

---

### Task 3: Electric-field lab simulation

**Files:**
- Modify: `assets/js/sims/efield.js`, `assets/css/style.css` (only if the panel needs styles)
- Test: `tests/e2e/test_estat.py`

**Interfaces:**
- Consumes: `EField.field/potential/traceLines/isWithin`, `makeHost` (`host.scene/camera/controls/world/renderer`, `setHome`, `onUpdate`), `makeUI` (`head/group/note/slider/seg/check/readouts/html`), `isDark()`, `themechange` event.
- Produces: `simEField(host, U) → { toggle(), dispose() }` and a test hook `window.__ef = { charges(), lines(), readout(x, z) → { E, V }, place(x, z, sign), select(i), setQ(i, q), preset(name), drag(i, x, z), testCharge(x, z), floorPixel(x, z) → [r, g, b] }` (debug only; may stay in production like `__px`). `floorPixel` renders the scene to a `WebGLRenderTarget` and reads the pixel at the projected world point (`renderer.readRenderTargetPixels`).

- [ ] **Step 1: Write failing browser tests** (open `#estat-sim`):
  - `test_dipole_preset`: `__ef.preset('dipole')` → 2 charges (+, −); `__ef.lines()` > 0; every line's first point within 1 unit of the + charge.
  - `test_place_drag_adjust`: place + at (0,0) and − at (10,0); drag the − to (12,0); `setQ(0, 3)`; readout at (6,0) equals `EField.field/potential` at that point within 0.5 %; page has no errors.
  - `test_readout_at_charge`: readout exactly at a charge position → finite numbers or `—` in the panel; no `NaN`/`Infinity` text anywhere in the panel.
  - `test_clear_and_negative_only`: clear → 0 charges, 0 lines, no errors; place one − → lines > 0.
  - `test_charge_cap`: place 9 charges → 8 exist and the panel shows a Thai message containing `8`.
  - `test_floor_matches_formula`: dipole preset; `__ef.floorPixel(x, z)` at 3 points (near +, near −, and on the perpendicular bisector) → warm (r > b) where `EField.potential` > 0, cool (b > r) where < 0, and near-neutral (|r − b| small) on the bisector where V ≈ 0.
  - `test_theme_switch`: toggle the theme twice → one canvas in the stage; floor uniforms/colours change; no errors.
  - `test_leave_mid_drag`: start a pointer drag on a charge, then set `location.hash = '#estat'` → no errors after 500 ms; back to `#estat-sim` works.
  - `test_mobile_layout`: 390×844, `#estat-sim` → no horizontal overflow; panel controls reachable.
  - `test_fps_drag` (smoke): dragging a charge for 1 s in headless records ≥ 10 rendered frames (software GL; real-device target ≥ 30 fps is checked by the owner).
  Run — Expected: FAIL.
- [ ] **Step 2: Implement** `simEField` per spec §6.3: charges on y = 0 (spheres sized by |q|), lines from `traceLines` rebuilt only when charges change (reduced `perUnitCharge` while dragging, full on release), arrowheads at intervals, floor `ShaderMaterial` with uniforms `uCharges[8]` (vec4 x, z, q, active), `uCount`, theme colours, contour spacing; raycast onto the floor for place/drag/readout; OrbitControls disabled during a charge drag; test charge integrates `v += (qE/m_eff)·dt`, damped, stops at a charge or the boundary; panel per spec; `dispose()` frees geometries, materials, textures and listeners (pointer + themechange).
- [ ] **Step 3: Run** `python3 tests/e2e/test_estat.py` and `npm test` — Expected: all PASS, `errors: none`. Look at screenshots (desktop dipole, plates, 390 px, dark) saved under the SDD workspace and fix anything unreadable.
- [ ] **Step 4: Commit** `feat(estat): electric field lab simulation`.

---

### Task 4: Lecture content and worked examples

**Files:**
- Modify: `index.html` (`lec-estat` full content, ≥ 1 `.wx` per section)
- Create: `docs/superpowers/content-review/estat.md` (lecture + examples part)
- Test: `tests/practice-content.test.js` (worked coverage applies once a practice file exists — Task 5; here use the e2e test below)

**Interfaces:** Consumes the `.wx` markup contract `<div class="wx"><div class="wx-q">…</div><ol class="wx-steps"><li>…</li>…≥2…</ol></div>` and the lecture conventions of the other templates.

- [ ] **Step 1: Write failing tests**: e2e `test_lecture_content` — `#estat` has five sections, each with ≥ 1 `.wx` (≥ 2 `<li>`), no `details.ex`, no `\text{` containing Thai, page not wider than 390 px at 390×844 after opening every `.wx`; and the lecture text contains `qV` (s4 energy gain) and `\varepsilon_0` (s5). Run — Expected: FAIL.
- [ ] **Step 2: Write** the lecture per spec §6.2 (sections, formulas, misconception boxes in the same style as other chapters, end card) and the worked examples; verify all example arithmetic in Python; one review line per section and per example in `estat.md`.
- [ ] **Step 3: Run** e2e + `npm test` — Expected: PASS.
- [ ] **Step 4: Commit** `feat(estat): lecture and worked examples`.
- [ ] **Step 5 (controller, does not block):** push `electrostatics`, open a draft PR, send the owner screenshots (simulation dipole + plates, a lecture section with an opened example, 390 px), continue with Task 5.

---

### Task 5: Practice set (20 items)

**Files:**
- Create: `assets/js/data/practice/estat.js`, `tests/practice-ref/compute_estat.py`, `tests/practice-ref/estat.json`
- Modify: `index.html` (script tag after the waves data script), `docs/superpowers/content-review/estat.md` (items part)

**Interfaces:** Consumes the item schema and validator used by the other seven chapters (`tests/practice-content.test.js`), `PracticeCore` helpers.

- [ ] **Step 1: Run** `npm test` after adding only the script tag and `PRACTICE.estat = []` — Expected: FAIL on estat counts / coverage / reference / worked coverage.
- [ ] **Step 2: Write** 20 items (7/7/6) covering s1–s5 (L1+L2) with L3 ≥ 2 sections each; misconceptions from spec §6.2 drive L1 distractors and mistake messages; `signed: true` on items whose answer or mistakes can be negative.
- [ ] **Step 3: Write and run** `python3 tests/practice-ref/compute_estat.py > tests/practice-ref/estat.json` (independent routes where possible).
- [ ] **Step 4: Run** `npm test` and `python3 tests/e2e/test_practice_ui.py` — Expected: all PASS (estat shows 7/7/6 in `test_all_chapters_have_practice`).
- [ ] **Step 5: Commit** `feat(estat): practice set`.

---

### Task 6: Cross-links, docs, final check

**Files:**
- Modify: `index.html` (`lec-particle`: note + link to estat s3 at the Lorentz-force section start and at the velocity selector; `lec-atom`: link to estat s4 at the stopping-potential text), `assets/js/app.js` (only if needed: support `#estat` + section target, e.g. `#estat?s=s3` or a `data-goto` handler that routes then scrolls to the section), `README.md` (chapter list, file tree, test command list), `tests/e2e/test_estat.py`

- [ ] **Step 1: Write failing test** `test_cross_links`: clicking the link in `lec-particle` lands on `#estat` with section `s3` scrolled into view (its top within the viewport); same for `lec-atom` → `s4`. Run — Expected: FAIL.
- [ ] **Step 2: Implement** the links (smallest routing addition) and README updates.
- [ ] **Step 3: Run the full suite** `npm test` and `for f in tests/e2e/test_*.py; do python3 $f || exit 1; done` — Expected: all PASS, `errors: none`.
- [ ] **Step 4: Commit** `feat(estat): cross-links from particle and atom; docs`.
- [ ] **Step 5 (finish stage, after the final whole-branch review):** mark the PR ready for review.
