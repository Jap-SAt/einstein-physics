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


if __name__ == '__main__':
    run_tests(globals())
