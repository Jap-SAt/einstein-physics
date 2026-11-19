"""Browser tests for CosmosVisuals (Tasks 3–4). Run: python3 tests/e2e/test_cosmos_visuals.py [test_name ...]"""
import os
from harness import open_page, run_tests

SHOTS = '/home/claude/shots_cc'
os.makedirs(SHOTS, exist_ok=True)

SETUP = """(opts) => {
  const box = document.createElement('div'); box.id = 'vbox';
  Object.assign(box.style, { position: 'fixed', left: '0', top: '0', width: '1280px', height: '720px', zIndex: 9999 });
  document.body.appendChild(box);
  window.__v = CosmosVisuals.create(box, Object.assign({ quality: 'high', reducedMotion: false, onUserCamera() {} }, opts || {}));
  window.__frames = (t, n, extra) => { for (let i = 0; i < n; i++) { __v.setState(Object.assign({ t, showGrid: false, showLabels: false }, extra || {})); __v.render(1 / 60); } };
  window.__brightness = () => {
    const src = document.querySelector('#vbox canvas'), c = document.createElement('canvas'); c.width = 160; c.height = 90;
    const g = c.getContext('2d'); g.drawImage(src, 0, 0, 160, 90); const d = g.getImageData(0, 0, 160, 90).data;
    let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3; return s / (d.length / 4);
  };
}"""


async def setup(s, **opts):
    await s.page.evaluate(SETUP, opts or None)


async def test_create_render_dispose():
    s = await open_page()
    try:
        await setup(s)
        await s.page.evaluate("__frames(1e-40, 30)")
        assert await s.page.evaluate("__v.debug.ambientCount()") == 100000
        await s.page.evaluate("__v.dispose()")
        assert await s.page.evaluate("document.querySelectorAll('#vbox canvas').length") == 0
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_every_era_renders():
    s = await open_page()
    try:
        await setup(s)
        eras = await s.page.evaluate("CosmosPhysics.ERAS.map(e => [e.id, Math.sqrt(e.start * e.end)])")
        dark = []
        for eid, t in eras:
            b = await s.page.evaluate(f"(() => {{ __frames({t}, 40); return __brightness(); }})()")
            await s.page.locator('#vbox').screenshot(path=f'{SHOTS}/era_{eid}.png')
            if b <= 2:
                dark.append((eid, b))
        assert not dark, dark
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_resize_zero():
    s = await open_page()
    try:
        await setup(s)
        await s.page.evaluate("""() => { const b = document.getElementById('vbox'); b.style.width = '0px'; b.style.height = '0px';
            __v.resize(); __frames(1e-9, 5); b.style.width = '800px'; b.style.height = '600px'; __v.resize(); __frames(1e-9, 2); }""")
        aspect = await s.page.evaluate("__v.camera.aspect")
        assert abs(aspect - 800 / 600) < 1e-6, aspect
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_reduced_motion_grade():
    s = await open_page()
    try:
        await setup(s, reducedMotion=True)
        await s.page.evaluate("__frames(1e-9, 5)")
        assert await s.page.evaluate("__v.debug.gradePassEnabled()") is True
        u = await s.page.evaluate("__v.debug.gradeUniforms()")
        assert u == {'grain': 0, 'aberration': 0}, u
    finally:
        await s.close()


async def test_quality_tiers():
    s = await open_page()
    try:
        await setup(s)
        await s.page.evaluate("__v.setQuality('low'); __frames(1e-9, 3)")
        assert await s.page.evaluate("__v.debug.ambientCount()") == 20000
        assert await s.page.evaluate("__v.renderer.getPixelRatio()") <= 1
        assert await s.page.evaluate("__v.quality") == 'low'
    finally:
        await s.close()


async def test_scrub_determinism():
    s = await open_page()
    try:
        await setup(s)
        same = await s.page.evaluate("""() => { __frames(3e-9, 3); const a = __v.debug.heroPositions();
            __frames(3.15576e7 * 2e9, 3); __frames(3e-9, 3); const b = __v.debug.heroPositions();
            return a.length > 0 && a.length === b.length && a.every((x, i) => x === b[i]); }""")
        assert same is True
    finally:
        await s.close()


async def test_strong_lines_only_in_quark_era():
    s = await open_page()
    try:
        await setup(s)
        q = await s.page.evaluate("(() => { __frames(1e-9, 2); return __v.strongPairs(); })()")
        a = await s.page.evaluate("(() => { __frames(1e-40, 2); return __v.strongPairs(); })()")
        n = await s.page.evaluate("(() => { __frames(180, 2); return __v.strongPairs(); })()")
        assert q > 0 and a == 0 and n == 0, (q, a, n)
    finally:
        await s.close()


async def test_labels_cap_and_spacing():
    s = await open_page()
    try:
        await setup(s)
        anchors = await s.page.evaluate("(() => { __frames(1e-9, 3, { showLabels: true }); return __v.labelAnchors(); })()")
        assert 0 < len(anchors) <= 12, len(anchors)
        for i in range(len(anchors)):
            for j in range(i + 1, len(anchors)):
                dx, dy = anchors[i]['x'] - anchors[j]['x'], anchors[i]['y'] - anchors[j]['y']
                assert (dx * dx + dy * dy) ** 0.5 >= 48, (anchors[i], anchors[j])
        off = await s.page.evaluate("(() => { __frames(1e-9, 2, { showLabels: false }); return __v.labelAnchors().length; })()")
        assert off == 0
    finally:
        await s.close()


async def test_no_center_expansion():
    s = await open_page()
    try:
        await setup(s)
        r = await s.page.evaluate("""() => {
            const Y = 3.15576e7, stats = t => { __frames(t, 2); const g = __v.debug.galaxyPositions(), n = g.length / 3;
              let cx = 0, cy = 0, cz = 0; for (let i = 0; i < n; i++) { cx += g[i*3]; cy += g[i*3+1]; cz += g[i*3+2]; }
              cx /= n; cy /= n; cz /= n; let s = 0, m = 0;
              for (let k = 0; k < 4000; k++) { const i = (k * 7919) % n, j = (k * 104729 + 13) % n; if (i === j) continue;
                s += Math.hypot(g[i*3]-g[j*3], g[i*3+1]-g[j*3+1], g[i*3+2]-g[j*3+2]); m++; }
              return { c: [cx, cy, cz], d: s / m, n, box: __v.debug.galaxyBox() }; };
            const t1 = 2e9 * Y, t2 = 6e9 * Y, a = stats(t1), b = stats(t2);
            const expected = __v.debug.galaxyScale(t2) / __v.debug.galaxyScale(t1);
            return { a, b, expected };
        }""")
        a, b, exp = r['a'], r['b'], r['expected']
        assert a['n'] >= 400, a['n']
        shift = sum((a['c'][i] - b['c'][i]) ** 2 for i in range(3)) ** 0.5
        assert shift <= 0.05 * b['box'], (shift, b['box'])
        ratio = b['d'] / a['d']
        assert abs(ratio - exp) <= 0.05 * exp, (ratio, exp)
    finally:
        await s.close()


async def test_nucleo_ratio():
    s = await open_page()
    try:
        await setup(s)
        c = await s.page.evaluate("(() => { __frames(1150, 2); return __v.debug.nucleiCounts(); })()")
        assert c['He'] > 0 and 11 <= c['H'] / c['He'] <= 13, c
    finally:
        await s.close()


if __name__ == '__main__':
    run_tests(globals())
