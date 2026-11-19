"""Browser tests for the Cosmos controller (Task 6). Run: python3 tests/e2e/test_cosmos_controller.py [test_name ...]"""
import random
from harness import open_page, run_tests

NO_WEBGL = """(() => { const g = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) { return /webgl/.test(type) ? null : g.call(this, type, ...a); }; })();"""


def page_errors(s):
    return [e for e in s.errors if e.startswith('pageerror')]


async def test_open_close_cycles():
    s = await open_page()
    try:
        before = await s.page.evaluate("document.body.style.overflow")
        for i in range(6):
            await s.page.evaluate("Cosmos.open()")
            await s.page.wait_for_timeout(100 if i == 2 else 300)
            await s.page.evaluate("Cosmos.close()")
        await s.page.wait_for_timeout(1000)
        r = await s.page.evaluate("({ n: document.querySelectorAll('.cc').length, open: Cosmos.isOpen(), ov: document.body.style.overflow })")
        assert r['n'] == 0 and r['open'] is False and r['ov'] == before, r
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_full_run_speed5():
    s = await open_page(viewport=(640, 400))
    try:
        await s.page.evaluate("Cosmos.open(); document.querySelector('.cc [data-speed=\"5\"]').click()")
        seen = []
        for _ in range(450):                                   # ≤ 45 s wall clock
            st = await s.page.evaluate("Cosmos.debug.state()")
            if not seen or seen[-1] != st['eraId']:
                seen.append(st['eraId'])
            if st['u'] >= 1:
                break
            await s.page.wait_for_timeout(100)
        assert st['u'] == 1 and st['playing'] is False, st
        order = await s.page.evaluate("CosmosPhysics.ERAS.map(e => e.id)")
        assert [e for e in order if e in seen] == seen, (seen, order)
        assert {'inflation', 'quark', 'nucleo', 'recomb', 'cosmicDawn', 'solar'} <= set(seen), seen
        vis = await s.page.evaluate("[...document.querySelectorAll('.cc-end button')].filter(b => b.offsetParent).map(b => b.textContent)")
        assert 'เล่นอีกครั้ง' in vis and 'กลับสู่บทเรียน' in vis, vis
        assert not page_errors(s), s.errors
    finally:
        await s.close()


async def test_scrub_storm():
    s = await open_page()
    try:
        await s.page.evaluate("Cosmos.open()")
        await s.page.wait_for_timeout(700)
        before = await s.page.evaluate("Cosmos.debug.impacts()")
        vals = [random.random() for _ in range(60)]
        vals[-1] = 0.6                                         # recombination → cosmic dawn region
        await s.page.evaluate("""async vals => { const r = document.querySelector('.cc input[type=range]');
          for (const v of vals) { r.value = String(v); r.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(f => setTimeout(f, 25)); } }""", vals)
        await s.page.wait_for_timeout(300)
        after = await s.page.evaluate("Cosmos.debug.impacts()")
        assert after == before, (before, after)
        r = await s.page.evaluate("""() => { const t = CosmosPhysics.sliderToTime(0.6), e = CosmosPhysics.eraAt(t);
          return { title: e.title, cap: document.querySelector('.cc-cap-title').textContent, u: Cosmos.debug.state().u }; }""")
        assert r['cap'] == r['title'] and abs(r['u'] - 0.6) < 1e-6, r
        await s.page.evaluate("document.querySelector('.cc input[type=range]').dispatchEvent(new Event('change', { bubbles: true }))")
        assert not page_errors(s), s.errors
    finally:
        await s.close()


async def test_long_frame_clamp():
    s = await open_page()
    try:
        await s.page.evaluate("Cosmos.open()")
        r = await s.page.evaluate("""() => {
          const E = CosmosPhysics.ERAS, i = E.findIndex(e => e.id === 'quark'), u0 = E.slice(0, i).reduce((a, e) => a + e.width, 0) + 1e-4;
          const r = document.querySelector('.cc input[type=range]'); r.value = String(u0);
          r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true }));
          const a = Cosmos.debug.state(); Cosmos.debug.frame(5.0); const b = Cosmos.debug.state();
          return { du: b.u - a.u, max: E[i].width / E[i].dur * 0.05 * b.speed, era: b.eraId, playing: b.playing }; }""")
        assert r['playing'] and 0 < r['du'] <= r['max'] + 1e-9 and r['era'] == 'quark', r
    finally:
        await s.close()


async def test_reduced_motion():
    s = await open_page(reduced_motion=True)
    try:
        await s.page.evaluate("""() => { window.__maxFlash = 0; Cosmos.open();
          const f = document.querySelector('.cc-flash'); const tick = () => { if (!f.isConnected) return;
            window.__maxFlash = Math.max(__maxFlash, parseFloat(getComputedStyle(f).opacity)); requestAnimationFrame(tick); }; tick(); }""")
        await s.page.wait_for_timeout(1500)
        r = await s.page.evaluate("({ flash: __maxFlash, grain: Cosmos.debug.vis.debug.gradeUniforms().grain })")
        assert r['flash'] == 0 and r['grain'] == 0, r
    finally:
        await s.close()


async def test_hero_atom_entry():
    s = await open_page()
    try:
        await s.page.click('#heroAtom')
        ok = False
        for _ in range(25):
            await s.page.wait_for_timeout(100)
            if await s.page.evaluate("Cosmos.isOpen() && Cosmos.debug.audioState() === 'running'"):
                ok = True
                break
        assert ok, await s.page.evaluate("({ open: Cosmos.isOpen(), audio: Cosmos.debug.audioState && Cosmos.debug.audioState() })")
        await s.page.keyboard.press('Escape')
        await s.page.wait_for_timeout(1000)
        r = await s.page.evaluate("({ open: Cosmos.isOpen(), dark: document.documentElement.classList.contains('dark'), home: !!document.querySelector('#heroAtom') })")
        assert r == {'open': False, 'dark': True, 'home': True}, r
        assert not page_errors(s), s.errors
    finally:
        await s.close()


async def test_no_webgl():
    s = await open_page(init_script=NO_WEBGL)
    try:
        r = await s.page.evaluate("""() => { Cosmos.open(); const e = document.querySelector('.cc-error');
          return { shown: !!e && /WebGL/.test(e.textContent) && /[ก-๙]/.test(e.textContent), open: Cosmos.isOpen(), canvas: document.querySelectorAll('.cc canvas').length }; }""")
        assert r['shown'] and r['open'] and r['canvas'] == 0, r
        await s.page.click('.cc-error button')
        await s.page.wait_for_timeout(1000)
        r = await s.page.evaluate("({ n: document.querySelectorAll('.cc').length, open: Cosmos.isOpen(), ov: document.body.style.overflow })")
        assert r['n'] == 0 and r['open'] is False and r['ov'] == '', r
        assert not page_errors(s), s.errors
    finally:
        await s.close()


async def test_reopen_during_audio_fade():
    s = await open_page()
    try:
        await s.page.evaluate("Cosmos.open()")
        await s.page.wait_for_timeout(400)
        await s.page.evaluate("Cosmos.close()")
        await s.page.wait_for_timeout(200)                     # inside the 0.6 s fade of the old engine
        await s.page.evaluate("Cosmos.primeAudio(); Cosmos.open()")
        await s.page.wait_for_timeout(1200)
        r = await s.page.evaluate("({ open: Cosmos.isOpen(), audio: Cosmos.debug.audioState() })")
        assert r == {'open': True, 'audio': 'running'}, r
    finally:
        await s.close()


async def test_inflation_hud_never_cold():
    s = await open_page()
    try:
        await s.page.evaluate("Cosmos.open()")
        r = await s.page.evaluate("""() => { const r = document.querySelector('.cc input[type=range]'), out = [];
          for (let u = 0.120; u < 0.1395; u += 0.001) { r.value = String(u); r.dispatchEvent(new Event('input', { bubbles: true })); Cosmos.debug.frame(0.016);
            const txt = document.querySelector('[data-hud=temp]').textContent, m = txt.match(/10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)/);
            const exp = m ? parseInt([...m[1]].map(c => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c) === 0 ? '-' : '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c) - 1).join(''), 10) : 0;
            out.push({ u: +u.toFixed(3), exp, txt }); }
          return out; }""")
        cold = [x for x in r if x['exp'] < 26]
        assert not cold, cold[:3]
    finally:
        await s.close()


async def test_open_flash_has_no_centre():
    s = await open_page()
    try:
        await s.page.evaluate("Cosmos.open()")
        bg = await s.page.evaluate("getComputedStyle(document.querySelector('.cc-flash')).backgroundImage")
        assert 'radial' not in bg, bg
    finally:
        await s.close()


async def test_mobile_end_buttons_clear_of_captions():
    s = await open_page(viewport=(390, 844))
    try:
        await s.page.evaluate("Cosmos.open(); for (let i = 0; i < 8; i++) document.querySelector('.cc [data-act=next]').click(); Cosmos.debug.frame(0.016)")
        await s.page.wait_for_timeout(2600)
        r = await s.page.evaluate("""() => { const R = q => document.querySelector(q).getBoundingClientRect(), e = R('.cc-end');
          const hit = q => { const b = R(q); return b.height > 0 && !(e.bottom <= b.top || e.top >= b.bottom || e.right <= b.left || e.left >= b.right); };
          return { ended: Cosmos.debug.state().u === 1, endShown: e.height > 0, hits: ['.cc-expert', '.cc-cap-text', '.cc-cap-title', '.cc-bigtime', '.cc-hud', '.cc-dock'].filter(hit) }; }""")
        assert r['ended'] and r['endShown'] and not r['hits'], r
    finally:
        await s.close()


if __name__ == '__main__':
    run_tests(globals())
