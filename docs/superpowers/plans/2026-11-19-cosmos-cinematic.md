# Cosmos Cinematic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "กำเนิดจักรวาล" overlay with a melodysheep-style cinematic, scrubbable, physically grounded Big Bang → life experience with procedural sound.

**Architecture:** Five classic-script modules under `assets/js/cosmos/`: a pure physics/timeline module (testable in Node), a Web Audio engine, a Three.js visual engine (post-processing, GPU ambient particles, closed-form CPU hero particles, grid, era objects), a DOM UI (dock/HUD/labels), and a controller exposing the unchanged `Cosmos` API. Every visual and audio parameter is a function of cosmic time `t`; only one-shot effects (impacts, flashes) depend on playback direction.

**Tech Stack:** Vanilla JS (classic scripts, globals), Three.js r147 UMD + `examples/js/postprocessing`, Web Audio API, Tailwind (prebuilt) + `assets/css/style.css`, Node 18+ `node --test`, Python Playwright with `/usr/bin/google-chrome` for browser tests.

**Spec:** `docs/superpowers/specs/2026-11-19-cosmos-cinematic-design.md` (original owner spec: `docs/superpowers/specs/2026-11-19-cosmos-original-spec.txt`)

## Global Constraints

- No React, no bundler, no ES modules: classic `<script>` files only; all libraries vendored locally (site is static on GitHub Pages and must work offline except Google Fonts).
- Three.js stays at r147 (`assets/vendor/three/three.min.js`); post-processing files come from `three@0.147.0/examples/js/` (copy from `/tmp/vend/three-0.147.0/package/examples/js/` or `npm pack three@0.147.0`).
- Public API unchanged: `Cosmos.open()`, `Cosmos.close()`, `Cosmos.isOpen()`; the only addition is `Cosmos.primeAudio()`.
- Fonts: Inter / IBM Plex Sans Thai for text; **JetBrains Mono for every number that changes over time** (`.mono` class).
- Background base colour `#05050A`.
- Cosmology: H₀ = 67.4 km/s/Mpc, Ωm = 0.315, Ωr = 9.1×10⁻⁵, ΩΛ = 1 − Ωm − Ωr, T₀ = 2.7255 K; age at a = 1 must be 13.8 Gyr ±1%.
- Timeline: piecewise-log from 10⁻⁴³ s to the computed age; ticks show true times; note text "สเกลเวลาแบบลอการิทึมแบ่งช่วง".
- Never depict a centre of expansion: galaxies fill space on a comoving lattice; camera sits among them.
- Physics text corrections are mandatory: no centre for Hubble's law; quark confinement at ~10⁻⁶ s; H:He 75:25 **by mass** (≈ 12:1 by number); CMB is light freed, not light created.
- Audio: start at 0 and ramp up over ~3 s; master `DynamicsCompressor`, peak ≤ ~−6 dBFS; mute toggle persisted in `localStorage` key `einstein_cosmos_muted`; impacts only on forward playback crossings and rate-limited.
- `prefers-reduced-motion: reduce` disables film grain, chromatic aberration, camera shake, auto-rotate and flashes.
- On close: cancel rAF, clear timers/listeners, dispose all GPU resources incl. composer render targets, `renderer.forceContextLoss()`, fade audio 0.6 s then `AudioContext.close()`.
- Quality tiers: high ≈100k ambient points / full-res bloom / DPR ≤ 2; medium ≈50k / half / 1.5; low ≈20k / quarter / 1, no chromatic aberration. Start high on desktop, medium on `(pointer: coarse)`; downgrade when mean frame time > 22 ms over 2 s; never upgrade mid-run.
- Performance target: ≥ 50 fps high on a mid laptop, ≥ 30 fps low.
- At most ~12 particle labels visible at once.
- UI copy is Thai; the whole run is ~105 s at 1× speed.

## Review Focus

1. **Fast scrubbing back and forth** (dragging the slider wildly): no burst of impact sounds, no flicker of era captions, and the same picture when returning to a time. → Task 6 test `test_scrub_storm`.
2. **Open/close repeatedly, including closing during the 0.6 s audio fade or during the hero-atom collapse**: no leftover overlay, timers, WebGL context or open AudioContext. → Task 6 test `test_open_close_cycles`.
3. **Resizing the window to tiny/zero size and back** (dev-tools dock, mobile rotation): no NaN camera aspect, composer follows size. → Task 3 test `test_resize_zero`.
4. **A long frame** (tab hidden then shown, GC pause): playback must not skip a whole era. → Task 6 test `test_long_frame_clamp`.
5. **Reduced-motion users and muted users returning later**: no flash/grain/shake; mute remembered across opens. → Task 2 test `test_mute_persists`, Task 6 test `test_reduced_motion`.

---

## File Structure

| File | Responsibility |
|---|---|
| `assets/js/cosmos/cosmos-physics.js` | Constants, ΛCDM scale-factor table, temperature, eras, slider↔time mapping, Thai formatting. Pure; `module.exports` when in Node. |
| `assets/js/cosmos/cosmos-audio.js` | `CosmosAudio`: shared AudioContext priming, procedural layers, impacts, mute, dispose. |
| `assets/js/cosmos/cosmos-visuals.js` | `CosmosVisuals`: renderer, composer + grade shader, camera rig, ambient GPU particles, hero particles, strong-force lines, grid, galaxy lattice, era objects, quality tiers. |
| `assets/js/cosmos/cosmos-ui.js` | `CosmosUI`: overlay DOM (dock, HUD, captions, expert box, labels layer), input events. |
| `assets/js/cosmos/cosmos.js` | `Cosmos` controller: lifecycle, playback clock, keyboard, wiring, one-shot triggers. |
| `assets/vendor/three/postprocessing/*.js` | Vendored r147 `EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, CopyShader, LuminosityHighPassShader`. |
| `assets/css/style.css` | New `.cc-*` styles; remove old `.cz-*` / `.cosmos` rules in Task 6. |
| `index.html` | Script tags in order: vendor postprocessing → physics → audio → visuals → ui → cosmos (replace `assets/js/cosmos.js`). |
| `assets/js/app.js` | One added call `Cosmos.primeAudio()` in the hero-atom click path. |
| `tests/cosmos-physics.test.js` | Node tests for the physics module. |
| `tests/e2e/harness.py` | Shared Playwright launcher (file:// page, swiftshader, autoplay allowed, console/page error capture). |
| `tests/e2e/test_cosmos_*.py` | Browser tests per task. |

Working copy: `/home/claude/atom` (a git repo is initialised there in Task 1 for task commits). The owner's folder `D:\ProjectEureka\project-Atom` is synced in Task 7; the owner commits/pushes with GitHub Desktop.

---

### Task 1: Physics and timeline module

**Files:**
- Create: `assets/js/cosmos/cosmos-physics.js`
- Test: `tests/cosmos-physics.test.js`

**Interfaces:**
- Produces global `CosmosPhysics` (and `module.exports = CosmosPhysics` when `typeof module !== 'undefined'`):
  - `CONST: { YEAR_S: 3.15576e7, T0_K: 2.7255, H0_PER_S: 67.4 / 3.0857e19, OMEGA_M: 0.315, OMEGA_R: 9.1e-5, OMEGA_L, T_START: 1e-43, T_INF_START: 1e-36, T_INF_END: 1e-32, INFLATION_EFOLDS: 60 }`
  - `ERAS: Era[]` where `Era = { id, title, start, end, width, dur, kind: 'main'|'bridge', text, fact|null, grade: { bloom: number, tint: [r,g,b], exposure: number } }`, contiguous in `t`, `width` summing to 1, `dur` = seconds at 1×.
  - `ageNow(): number` — seconds at a = 1.
  - `scaleFactor(t: number): number`
  - `temperature(t: number): number` (K) and `isTemperatureApprox(t: number): boolean`
  - `timeToSlider(t: number): number` / `sliderToTime(u: number): number` (u ∈ [0,1], clamps outside)
  - `eraIndexAt(t: number): number` / `eraAt(t: number): Era` / `eraProgress(t: number): number` (0–1 within era, log-linear)
  - `formatTime(t: number): string`, `formatSci(x: number, digits?: number): string` (`"1.5 × 10²⁶"` with superscripts, `"≈ 0 วินาที"` for t ≤ 1e-43 handled by formatTime)

Era table (ids, bounds, widths, durations are fixed by this plan; titles/text in Thai, facts verbatim from spec §5):

| id | start | end | width | dur (s) | kind |
|---|---|---|---|---|---|
| `inflation` | 1e-43 | 1e-32 | 0.14 | 10 | main |
| `electroweak` | 1e-32 | 1e-12 | 0.05 | 5 | bridge |
| `quark` | 1e-12 | 1 | 0.14 | 12 | main |
| `nucleo` | 1 | 1200 | 0.13 | 12 | main |
| `radiation` | 1200 | 2.5e5 yr | 0.05 | 5 | bridge |
| `recomb` | 2.5e5 yr | 1e8 yr | 0.14 | 14 | main |
| `cosmicDawn` | 1e8 yr | 9.2e9 yr | 0.18 | 22 | main |
| `solar` | 9.2e9 yr | ageNow() | 0.17 | 25 | main |

Temperature model: `t ≥ 1 s`: `T0_K / scaleFactor(t)`; `1e-32 ≤ t < 1 s`: `1.5e10 * t^-0.5`; `1e-36 ≤ t < 1e-32` (inflation, approx): `T_reheat * exp(-INFLATION_EFOLDS * (1 - f))` rising back to `T_reheat = 1.5e10 * (1e-32)^-0.5` at f = 1, where f is the linear-time fraction through inflation; `t < 1e-36`: `1.4e32 * (t / 1e-43)^-0.5`. `isTemperatureApprox(t)` is `t < 1e-12`.

Scale factor model: integrate `dt = da / (a · H0 · sqrt(Ωr a⁻⁴ + Ωm a⁻³ + ΩΛ))` on a log-spaced grid of `a` from 1e-30 to 1 (≥ 4,000 points, trapezoid in `ln a`, analytic `t = a² / (2 H0 √Ωr)` below the grid start), store `(ln t, ln a)` and interpolate. For `t < T_INF_END` use: `a_end = scaleFactor(T_INF_END)` from the radiation law; inside inflation `a = a_end * exp(-INFLATION_EFOLDS * (T_INF_END - t) / (T_INF_END - T_INF_START))`; before inflation `a = a_end * e^-60 * sqrt(t / T_INF_START)`.

- [ ] **Step 1: Initialise the working repo**

Run: `cd /home/claude/atom && (git rev-parse --git-dir >/dev/null 2>&1 || (git init -q && git add -A && git commit -qm "baseline: site before cosmos cinematic"))`
Expected: exits 0; `git log --oneline | head -1` shows a commit.

- [ ] **Step 2: Write the failing tests** in `tests/cosmos-physics.test.js` using `node:test` + `node:assert/strict`, loading `require('../assets/js/cosmos/cosmos-physics.js')`:

```js
test('age at a=1 is 13.8 Gyr ±1%', () => { const gyr = P.ageNow() / P.CONST.YEAR_S / 1e9; assert.ok(gyr > 13.66 && gyr < 13.94, gyr); });
test('scale factor at 380 kyr ≈ 1/1100 ±10%', () => { const a = P.scaleFactor(3.8e5 * P.CONST.YEAR_S); assert.ok(a > 1/1210 && a < 1/990, a); });
test('temperature at 380 kyr ≈ 3000 K ±15%', () => { const T = P.temperature(3.8e5 * P.CONST.YEAR_S); assert.ok(T > 2550 && T < 3450, T); });
test('temperature at 1 s is ~1e10 K', () => { const T = P.temperature(1); assert.ok(T > 3e9 && T < 3e10, T); });
test('temperature today is T0', () => { assert.ok(Math.abs(P.temperature(P.ageNow()) - 2.7255) < 0.01); });
test('scale factor is increasing', () => { let prev = 0; for (let e = -43; e <= 17.6; e += 0.05) { const a = P.scaleFactor(10 ** e); assert.ok(a > prev, e); prev = a; } });
test('slider round-trips and is monotonic', () => { let prev = -1; for (let i = 0; i <= 1000; i++) { const u = i / 1000, t = P.sliderToTime(u); assert.ok(Math.abs(P.timeToSlider(t) - u) < 1e-9, u); assert.ok(t > prev); prev = t; } });
test('slider ends hit the timeline ends', () => { assert.equal(P.sliderToTime(0), 1e-43); assert.ok(Math.abs(P.sliderToTime(1) / P.ageNow() - 1) < 1e-9); assert.equal(P.sliderToTime(-1), 1e-43); });
test('eras are contiguous, widths sum to 1, every t has an era', () => { const E = P.ERAS; assert.ok(Math.abs(E.reduce((s, e) => s + e.width, 0) - 1) < 1e-9); for (let i = 1; i < E.length; i++) assert.equal(E[i].start, E[i - 1].end); for (let e = -43; e <= 17.6; e += 0.01) assert.ok(P.eraAt(10 ** Math.min(e, Math.log10(P.ageNow()))), e); });
test('key events sit in the right eras', () => { assert.equal(P.eraAt(1e-6).id, 'quark'); assert.equal(P.eraAt(180).id, 'nucleo'); assert.equal(P.eraAt(3.8e5 * P.CONST.YEAR_S).id, 'recomb'); assert.equal(P.eraAt(1e9 * P.CONST.YEAR_S).id, 'cosmicDawn'); assert.equal(P.eraAt(4.0e9 * P.CONST.YEAR_S + 9.2e9 * P.CONST.YEAR_S).id, 'solar'); });
test('main eras have expert facts, bridges do not', () => { for (const e of P.ERAS) assert.equal(!!e.fact, e.kind === 'main', e.id); });
test('mandatory physics corrections are present', () => { const all = P.ERAS.map(e => e.text + ' ' + (e.fact || '')).join(' '); for (const s of ['ไม่มีจุดศูนย์กลาง', '10⁻⁶', 'โดยมวล', '2.7 K']) assert.ok(all.includes(s), s); });
test('formatting', () => { assert.equal(P.formatTime(1e-43), '≈ 0 วินาที'); assert.match(P.formatTime(1e-35), /× 10⁻³⁵ วินาที$/); assert.match(P.formatTime(3.8e5 * P.CONST.YEAR_S), /^380,000 ปี$/); assert.match(P.formatTime(P.ageNow()), /พันล้านปี$/); assert.equal(P.formatSci(1.5e26, 1), '1.5 × 10²⁶'); });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /home/claude/atom && node --test tests/`
Expected: FAIL — `Cannot find module '../assets/js/cosmos/cosmos-physics.js'`

- [ ] **Step 4: Implement `cosmos-physics.js`** per the Interfaces block and the models above. `formatTime` units: < 1e-3 s → sci seconds; < 60 s → `x.x วินาที`; < 3600 → `x.x นาที`; < 1 day → ชั่วโมง; < 1e6 yr → `n,nnn ปี`; < 1e9 yr → `n ล้านปี`; else `x.xx พันล้านปี`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /home/claude/atom && node --test tests/`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add assets/js/cosmos/cosmos-physics.js tests/cosmos-physics.test.js && git commit -m "feat(cosmos): ΛCDM timeline and physics module"
```

---

### Task 2: Audio engine

**Files:**
- Create: `assets/js/cosmos/cosmos-audio.js`, `tests/e2e/harness.py`, `tests/e2e/test_cosmos_audio.py`

**Interfaces:**
- Consumes: `CosmosPhysics.ERAS` ids.
- Produces global `CosmosAudio`:
  - `prime(): AudioContext|null` — create (once) and `resume()` a shared context; safe to call repeatedly; must be called inside a user gesture.
  - `create(): Engine` — builds the graph on the primed context (primes if none).
  - `Engine.start(): void` (master gain ramps 0 → level over 3 s unless muted)
  - `Engine.update(t: number, eraId: string, playing: boolean, collisions: number): void` — per frame; all continuous params are functions of `t`/`eraId`; `collisions` drives the quark-era crackle density.
  - `Engine.impact(kind: 'bigbang'|'era'|'cmb'|'star'): boolean` — returns `false` when rate-limited (min gap 600 ms, global).
  - `Engine.setMuted(m: boolean): void` (persists `einstein_cosmos_muted` as `"1"`/`"0"`), `Engine.isMuted(): boolean` (initial value read from storage, default false)
  - `Engine.isSuspended(): boolean`, `Engine.resumeFromGesture(): Promise<void>`
  - `Engine.dispose(): Promise<void>` — fade 0.6 s, stop sources, `close()` context, null the shared context so the next `prime()` makes a new one.
  - `Engine.debug: { impactsPlayed: number, contextState(): string, masterGain(): number }`
- Layers and per-era chords per spec §7; reverb via `ConvolverNode` with a generated 3.5 s decaying-noise IR; master chain `layers → reverb send / dry → DynamicsCompressor(threshold −14 dB, ratio 4) → master GainNode (target 0.45) → destination`.
- `harness.py` exposes `async def open_page(hash='home', reduced_motion=False)` returning `(browser, page, errors)`; launch args `--use-gl=swiftshader --enable-webgl --ignore-gpu-blocklist --autoplay-policy=no-user-gesture-required`; page `file:///home/claude/atom/index.html`; aborts non-file requests.

- [ ] **Step 1: Write the failing browser tests** in `test_cosmos_audio.py` (each test loads the page and calls `CosmosAudio` directly via `page.evaluate`):
  - `test_ramp_and_compressor`: after `prime(); e=create(); e.start()`, `masterGain()` < 0.05 at 100 ms and ≥ 0.4 at 3.5 s; `contextState()` == `'running'`.
  - `test_impact_rate_limit`: 10 × `impact('era')` in one tick → exactly 1 returns true; `impactsPlayed` == 1; after 700 ms another returns true.
  - `test_mute_persists`: `setMuted(true)` → `localStorage.einstein_cosmos_muted == '1'`; a new engine after `dispose()` reports `isMuted() === true` and `masterGain()` stays < 0.01 after 3.5 s.
  - `test_dispose_closes`: after `await dispose()`, `contextState()` == `'closed'`; `prime()` returns a new context whose state is not `'closed'`.
  - `test_update_all_eras`: calling `update` across `t` sampled through every era for 2 s raises no page errors.

- [ ] **Step 2: Run to verify failure**

Run: `cd /home/claude && python3 /home/claude/atom/tests/e2e/test_cosmos_audio.py`
Expected: FAIL — `CosmosAudio is not defined` (script not yet included). Add `<script src="assets/js/cosmos/cosmos-physics.js">` and `<script src="assets/js/cosmos/cosmos-audio.js">` to `index.html` before `assets/js/cosmos.js` as part of Step 3.

- [ ] **Step 3: Implement `cosmos-audio.js`** per Interfaces; impacts are suppressed while `playing === false` in the last `update` call.

- [ ] **Step 4: Run to verify pass**

Run: `python3 /home/claude/atom/tests/e2e/test_cosmos_audio.py`
Expected: prints `PASS` for all five tests and `errors: none`.

- [ ] **Step 5: Commit**

```bash
git add assets/js/cosmos/cosmos-audio.js tests/e2e index.html && git commit -m "feat(cosmos): procedural Web Audio engine"
```

---

### Task 3: Visual core — renderer, post-processing, camera, ambient particles

**Files:**
- Create: `assets/js/cosmos/cosmos-visuals.js`, `assets/vendor/three/postprocessing/{EffectComposer,RenderPass,ShaderPass,UnrealBloomPass}.js`, `assets/vendor/three/shaders/{CopyShader,LuminosityHighPassShader}.js`, `tests/e2e/test_cosmos_visuals.py`
- Modify: `index.html` (vendor scripts after `OrbitControls.js`; `cosmos-visuals.js` after audio)

**Interfaces:**
- Consumes: `CosmosPhysics.ERAS[i].grade`, `eraAt`, `eraProgress`, `scaleFactor`.
- Produces global `CosmosVisuals`:
  - `create(container: HTMLElement, opts: { quality: 'high'|'medium'|'low', reducedMotion: boolean, onUserCamera: () => void }): Vis`
  - `Vis.setState(s: { t: number, showGrid: boolean, showLabels: boolean }): void` — everything derived from `t`
  - `Vis.render(dt: number): void`, `Vis.resize(): void`, `Vis.resetCamera(): void` (re-enables auto camera)
  - `Vis.setQuality(q): void`, `Vis.quality: string`
  - `Vis.dispose(): void` (all geometries/materials/textures/render targets once each, controls, `forceContextLoss`, canvas removed)
  - `Vis.debug: { ambientCount(): number, bloomStrength(): number, gradePassEnabled(): boolean, gradeUniforms(): { grain: number, aberration: number } }`
- Ambient particles: one `THREE.Points` with `ShaderMaterial` (additive, no depth write); attributes `seed (vec4)`; uniforms `uT` (log10 t), `uEraA`, `uEraB` (era indices), `uMix`, `uScale` (a(t) relative to era reference), `uPixelRatio`, `uSize`. Vertex shader contains one layout function per era id; colour per era per spec §6.1.
- Grade pass: one `ShaderPass` with uniforms `uTime, uGrain, uVignette, uAberration, uTint, uExposure`; ACES filmic curve; grain/aberration forced to 0 when `reducedMotion` (and aberration 0 on low tier).
- Camera rig: per-era keyframes `{ pos: [x,y,z], target: [x,y,z], fov }` (builder chooses values) interpolated by `eraProgress`; handheld noise amplitude 0.15 units off when reduced motion; OrbitControls `start` → `onUserCamera()` and auto camera paused until `resetCamera()`.

- [ ] **Step 1: Write failing tests** in `test_cosmos_visuals.py` (create a 1280×720 container via `page.evaluate`):
  - `test_create_render_dispose`: `create` → `setState({t:1e-40})` → 30 frames → `ambientCount()` == 100000 on high; `dispose()` leaves no `canvas` in the container and no page errors.
  - `test_every_era_renders`: for each era midpoint `t`, render 10 frames and take a screenshot to `/home/claude/shots_cc/era_<id>.png`; mean pixel brightness of the canvas (read via `toDataURL` in a 2D canvas) is > 2/255 for every era (nothing renders black).
  - `test_resize_zero`: set container to 0×0, call `resize()` and render 5 frames, then back to 800×600: camera `aspect` is finite and equals 800/600 ± 1e-6; no errors.
  - `test_reduced_motion_grade`: with `reducedMotion: true`, `gradePassEnabled()` true and `gradeUniforms()` returns `{ grain: 0, aberration: 0 }`.
  - `test_quality_tiers`: `setQuality('low')` → `ambientCount()` == 20000 and renderer pixel ratio ≤ 1.

- [ ] **Step 2: Run to verify failure** — `python3 /home/claude/atom/tests/e2e/test_cosmos_visuals.py` → FAIL `CosmosVisuals is not defined`.

- [ ] **Step 3: Vendor the six r147 files and implement the core** per Interfaces. Era layouts in the shader follow spec §5 table "สิ่งที่เกิด / ภาพหลัก"; the expansion in eras ≥ `recomb` multiplies comoving positions by `uScale` (no fixed centre — positions fill a periodic box larger than the view).

- [ ] **Step 4: Run to verify pass** — all five print `PASS`; view the 8 screenshots.

- [ ] **Step 5: Commit**

```bash
git add assets/js/cosmos/cosmos-visuals.js assets/vendor/three tests/e2e/test_cosmos_visuals.py index.html && git commit -m "feat(cosmos): cinematic renderer, grade pass, ambient GPU particles"
```

---

### Task 4: Hero particles, strong-force lines, labels, grid, galaxies and era objects

**Files:**
- Modify: `assets/js/cosmos/cosmos-visuals.js`
- Test: `tests/e2e/test_cosmos_visuals.py` (add tests)

**Interfaces:**
- Produces on `Vis`:
  - `Vis.heroCount: number` (1,000)
  - `Vis.labelAnchors(): Array<{ text: string, x: number, y: number }>` — screen px, ≤ 12, nearest-first, non-overlapping (min 48 px apart)
  - `Vis.strongPairs(): number` — pairs drawn this frame (0 outside `quark` era)
  - `Vis.debug.heroPositions(): Float32Array` (copy), `Vis.debug.galaxyPositions(): Float32Array`, `Vis.debug.nucleiCounts(): { H: number, He: number }`
- Hero motion: closed-form `f(seed, t)` only (seeded value noise / sum of sines); quarks group into triplets at `t ≥ 1e-6 s`; nucleons into ²H/⁴He clusters across `nucleo` with final H:He nuclei ≈ 12:1; electrons into orbits across `recomb`. Strong-force lines: spatial hash of quark positions each frame, link pairs closer than a threshold, fade by distance.
- Grid: line grid (comoving spacing × `scaleFactor(t)` normalised per era), stretches visibly through inflation; small dips under galaxies in `cosmicDawn`; visible only when `showGrid`.
- Galaxies: ≥ 400 billboards/point clusters on a jittered comoving lattice filling a periodic box; physical position = comoving × normalised `a(t)`; first stars ignite (blue) early in `cosmicDawn`, spirals form later.
- `solar` objects: protoplanetary disk (Kepler ω ∝ r^-1.5), Sun, planets accreting, Earth (23.4° tilt, procedural texture), DNA helix from hero/ambient points at the end.

- [ ] **Step 1: Add failing tests:**
  - `test_scrub_determinism`: `setState({t:A})`→render→`heroPositions()`=P1; set t=B (another era), render; set t=A again → `heroPositions()` equals P1 element-wise (exact).
  - `test_strong_lines_only_in_quark_era`: `strongPairs()` > 0 at `t=1e-9`, == 0 at `t=1e-40` and at `t=180`.
  - `test_labels_cap_and_spacing`: at `t=1e-9` with labels on, `labelAnchors().length` ≤ 12 and all pairwise distances ≥ 48 px; with labels off → 0.
  - `test_no_center_expansion`: at two times in `cosmicDawn`, the centroid of `galaxyPositions()` stays within 5% of the box size of its earlier value and the mean pairwise distance grows by the ratio of `scaleFactor` ± 5% (uniform expansion, not radial burst).
  - `test_nucleo_ratio`: `Vis.debug.nucleiCounts()` at the end of `nucleo` gives H:He within 11:1–13:1.

- [ ] **Step 2: Run to verify failure** (missing methods).
- [ ] **Step 3: Implement** per Interfaces.
- [ ] **Step 4: Run to verify pass**; refresh era screenshots and inspect them for any image suggesting a centre of expansion.
- [ ] **Step 5: Commit** — `git commit -am "feat(cosmos): hero particles, strong-force lines, labels, grid, galaxies, finale objects"`

---

### Task 5: UI — dock, HUD, captions, labels layer

**Files:**
- Create: `assets/js/cosmos/cosmos-ui.js`, `tests/e2e/test_cosmos_ui.py`
- Modify: `assets/css/style.css` (add `.cc-*` rules), `index.html` (script tag after visuals)

**Interfaces:**
- Consumes: `CosmosPhysics.ERAS`, `timeToSlider`, `formatTime`, `formatSci`.
- Produces global `CosmosUI`:
  - `create(handlers: { onScrub(u: number), onScrubEnd(), onPlayToggle(), onSpeed(n: 1|2|5), onToggleGrid(on: boolean), onToggleLabels(on: boolean), onToggleSound(), onPrevEra(), onNextEra(), onClose() }): UI`
  - `UI.root: HTMLElement` (overlay with `role="dialog"`, `aria-modal="true"`), `UI.stage: HTMLElement` (container for the canvas)
  - `UI.update(s: { t: number, u: number, tempK: number, tempApprox: boolean, scale: number, playing: boolean, speed: number, muted: boolean, soundSuspended: boolean, eraIndex: number }): void` — writes DOM only when text changes
  - `UI.showEra(era: Era): void` — title/text fade, expert box fades in after 2 s (main eras only)
  - `UI.setLabels(anchors): void`, `UI.setGrid(on)`, `UI.setLabelsOn(on)`, `UI.dispose(): void`
- Dock: `<input type="range" min=0 max=1 step=0.0001>` with era ticks at cumulative `width`s and tick labels showing true times; note "สเกลเวลาแบบลอการิทึมแบ่งช่วง"; play/pause, speed segmented 1×/2×/5×, grid, labels, sound (shows "แตะเพื่อเปิดเสียง" when `soundSuspended`), close. HUD top-right: time (`.mono`), T (`.mono`, prefix "≈" when approx), a (`.mono`), era title + text. Cinematic layer (spec §6.7): a large time counter (`.mono`, light weight) and the era title fading in/out, lower-left, with the expert box beneath. Two-row dock under 700 px width.

- [ ] **Step 1: Failing tests:**
  - `test_dom_and_a11y`: root has `role=dialog`, range input exists, 8 era ticks, all numeric HUD fields carry class `mono`.
  - `test_handlers_fire`: dispatch input on range → `onScrub` receives the value; clicking 5× → `onSpeed(5)`; Space is not handled by UI (controller owns keys).
  - `test_update_writes_only_on_change`: calling `update` twice with the same state performs 0 DOM text mutations the second time (MutationObserver count).
  - `test_approx_prefix`: `tempApprox: true` → temperature text starts with `≈`.
  - `test_mobile_dock`: at 390×844 viewport the dock wraps into 2 rows and nothing overflows horizontally (`scrollWidth <= clientWidth`).
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** per Interfaces; styles follow the site look (glass dock `backdrop-filter: blur(14px)`, `#05050A` base, warm gold accents).
- [ ] **Step 4: Run to verify pass.**
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(cosmos): dock, HUD, captions and labels UI"`

---

### Task 6: Controller, integration, removal of the old overlay

**Files:**
- Create: `assets/js/cosmos/cosmos.js`, `tests/e2e/test_cosmos_controller.py`
- Delete: `assets/js/cosmos.js`; old `.cosmos` / `.cz-*` rules in `assets/css/style.css`
- Modify: `index.html` (replace old script tag with the new module order), `assets/js/app.js` (in `renderHome`, add `btn.addEventListener('click', () => Cosmos.primeAudio())` next to the hero-atom creation)

**Interfaces:**
- Consumes: everything above.
- Produces global `Cosmos`: `open(opts?: { onClose?: () => void }): void`, `close(): void`, `isOpen(): boolean`, `primeAudio(): void`, and `Cosmos.debug: { state(): { t, u, eraId, playing, speed, quality }, frame(dt: number): void, impacts(): number, vis: Vis|null }` (debug only; used by tests).
- Each frame: `engine.update(t, era.id, playing, vis.strongPairs())`, `ui.update(...)`, `ui.setLabels(vis.labelAnchors())` when labels are on.
- Playback: while playing, `u` advances within the current era at `width / dur` per second × speed; `dt` clamped to 0.05 s; reaching `u = 1` stops playing and shows the end buttons ("เล่นอีกครั้ง", "กลับสู่บทเรียน"). Scrubbing sets `u` directly, pauses auto-advance until `onScrubEnd`, and never triggers impacts. Forward playback crossing an era start triggers `impact('era')` (`'bigbang'` at open, `'cmb'` entering `recomb`, `'star'` at first-star ignition in `cosmicDawn`).
- Lifecycle: `open` → `Theme.set('dark')` after setting the session (so `app.js`'s theme listener sees `isOpen()`), UI + visuals + audio created, quality = high (desktop) / medium (`pointer: coarse`), frame-time monitor downgrades; `close` → stop loop, `ui.dispose`, `vis.dispose`, `await engine.dispose()` without blocking UI removal, restore body overflow and focus, call `opts.onClose` or `route(true)`.
- Keyboard: Space play/pause, ←/→ previous/next era start, Esc close; ignore with Ctrl/Meta/Alt; ignore key repeat for Space.
- WebGL failure: catch, show a short Thai message in the overlay with a close button, keep audio off.

- [ ] **Step 1: Failing tests:**
  - `test_open_close_cycles`: 6× (`Cosmos.open()`, wait 300 ms, `Cosmos.close()`), including one close 100 ms after open; then: no `.cc-root` in DOM after 1 s, `Cosmos.isOpen()` false, `document.body.style.overflow` restored, no page errors.
  - `test_full_run_speed5`: open, set speed 5, wait until `state().u === 1` (≤ 30 s headless), era ids visited in order, end buttons visible.
  - `test_scrub_storm`: 60 random `onScrub` values within 1.5 s via range input events → `impacts()` unchanged; caption shows the era of the last value.
  - `test_long_frame_clamp`: at the start of `quark`, `debug.frame(5.0)` advances `u` by ≤ `width/dur × 0.05 × speed` (still `quark`).
  - `test_reduced_motion`: page with reduced motion → the overlay flash element never gets opacity > 0 and `gradeUniforms().grain` is 0 (expose the live `Vis` as `Cosmos.debug.vis` for this test).
  - `test_hero_atom_entry`: home page click `#heroAtom` → within 2.5 s `Cosmos.isOpen()` and audio context `running`; Esc → home re-rendered in dark mode.
  - `test_no_webgl`: with `WebGLRenderingContext` stubbed to fail, `Cosmos.open()` shows the Thai message and closes cleanly.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** controller; remove the old file and CSS; update `index.html` and the one line in `app.js`.
- [ ] **Step 4: Run all suites:** `node --test tests/ && for f in /home/claude/atom/tests/e2e/test_*.py; do python3 $f || exit 1; done` → all PASS, `errors: none`.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(cosmos): cinematic controller replaces the old overlay"`

---

### Task 7: Polish pass, docs and delivery

**Files:**
- Modify: `README.md` (กำเนิดจักรวาล section and file tree), any of the cosmos files for visual tuning
- Sync: all changed/created files to `D:\ProjectEureka\project-Atom` via `device_commit_files` (expectedMtime from a fresh `device_list_dir`)

- [ ] **Step 1: Visual review** — capture one screenshot per era at high quality to `/home/claude/shots_cc/`; check against spec §6 (grade per era, no centre of expansion, ≤ 12 labels, text not cluttered) and fix anything off.
- [ ] **Step 2: Performance** — headless frame-time log for 10 s per tier (record numbers); include a short owner checklist to measure fps on their MSI laptop via the browser's FPS meter.
- [ ] **Step 3: Update README** (controls, sound/mute, quality tiers, physics model sources: Planck 2018 cosmology).
- [ ] **Step 4: Full test run** as Task 6 Step 4 → all PASS.
- [ ] **Step 5: Commit locally** — `git add -A && git commit -m "docs(cosmos): README and polish"`
- [ ] **Step 6: Sync to the owner's folder**, verify sizes match with `device_list_dir`, then ask the owner to Commit + Push in GitHub Desktop.
