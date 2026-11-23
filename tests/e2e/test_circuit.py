"""Browser tests for the circuits chapter: registration (Task 2).
Run: python3 tests/e2e/test_circuit.py [test_name ...]"""
import os
from harness import open_page, run_tests, ROOT


async def test_home_order():
    s = await open_page('home')
    try:
        r = await s.page.evaluate("""() => [...document.querySelectorAll('a.pick')].map(a => a.getAttribute('href'))""")
        assert r == ['#mech', '#thermo', '#waves', '#estat', '#circuit', '#particle', '#em', '#atom', '#nuclear'], r
        mods = await s.page.evaluate("() => MODS.map(m => [m.id, m.no, m.title, m.group])")
        assert [m[1] for m in mods] == ['0%d' % i for i in range(1, 10)], mods
        by = {m[0]: m for m in mods}
        assert by['circuit'][1:] == ['05', 'ไฟฟ้ากระแสและวงจร', 'classic'], by['circuit']
        assert by['particle'][1] == '06' and by['particle'][3] == 'modern', by['particle']
        assert by['nuclear'][1] == '09', by['nuclear']
        sub = await s.page.evaluate("() => document.querySelector('a.pick[href=\"#circuit\"] .s').textContent.trim()")
        assert sub == 'กระแส · กฎของโอห์ม · อนุกรมและขนาน · เคอร์ชอฟฟ์ · วงจร RC', sub
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_old_links_and_progress():
    s = await open_page('home')
    try:
        iid = await s.page.evaluate("() => PRACTICE.particle[0].id")
        eid = await s.page.evaluate("() => PRACTICE.estat[0].id")
    finally:
        await s.close()
    init = ("localStorage.setItem('einstein_practice_particle', JSON.stringify({v:1, items:{'%s':{s:'ok',n:1,t:1}}}));"
            "localStorage.setItem('einstein_practice_estat', JSON.stringify({v:1, items:{'%s':{s:'ok',n:1,t:1}}}));" % (iid, eid))
    s = await open_page('particle', init_script=init)
    try:
        assert await s.page.inner_text('.lec h1') == 'อนุภาคในสนามแม่เหล็ก'
        base = s.page.url.split('#')[0]
        await s.page.goto(base + '#particle-quiz')
        await s.page.wait_for_selector('.px-row')
        assert await s.page.evaluate("() => document.querySelectorAll('.px-dot.ok').length") == 1
        await s.page.goto(base + '#estat-quiz')
        await s.page.wait_for_selector('.px-row')
        assert await s.page.evaluate("() => document.querySelectorAll('.px-dot.ok').length") == 1
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_circuit_tabs():
    s = await open_page('circuit')
    try:
        ids = await s.page.evaluate("() => [...document.querySelectorAll('.lec h2')].map(h => h.id)")
        assert ids == ['s1', 's2', 's3', 's4', 's5'], ids
        tx = await s.page.evaluate("() => [...document.querySelectorAll('.lec h2')].map(h => h.textContent.replace(/^\\d+/, ''))")
        assert tx == ['กระแสไฟฟ้าและแรงเคลื่อนไฟฟ้า', 'ความต้านทานและกฎของโอห์ม', 'วงจรอนุกรมและขนาน',
                      'กฎของเคอร์ชอฟฟ์', 'กำลังไฟฟ้าและวงจร RC'], tx
        base = s.page.url.split('#')[0]
        await s.page.goto(base + '#circuit-sim')
        await s.page.wait_for_selector('#stage canvas')
        await s.page.goto(base + '#circuit-quiz')
        await s.page.wait_for_timeout(300)
        assert 'แบบฝึกหัดบทนี้กำลังจัดทำ' in await s.page.inner_text('#tabview')
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_no_hardcoded_count():
    with open(os.path.join(ROOT, 'index.html'), encoding='utf-8') as f:
        assert '8 บท' not in f.read()
    s = await open_page('home')
    try:
        assert '8 บท' not in await s.page.inner_text('body')
    finally:
        await s.close()


# ───────────── Task 3: circuit lab (#circuit-sim) ─────────────

SCENES = ['single', 'series', 'parallel', 'mixed', 'twoloop', 'rc']
PREFIX = {'': 1, 'k': 1e3, 'm': 1e-3, 'µ': 1e-6, 'n': 1e-9}


def close(a, b, rel=0.005):
    return a is not None and b is not None and abs(a - b) <= rel * abs(b) + 1e-9


def parse_si(txt, unit):
    """'2.50 ms' -> 0.0025 ; '−1.09 A' -> -1.09"""
    t = txt.strip().replace('−', '-')
    num, u = t.split(' ', 1)
    u = u.strip()
    assert u.endswith(unit), (txt, unit)
    return float(num) * PREFIX[u[:-len(unit)]]


async def open_sim(**kw):
    s = await open_page('circuit-sim', **kw)
    await s.page.wait_for_selector('#stage canvas')
    await s.page.wait_for_function("() => window.__ck && __ck.ready && __ck.ready()")
    return s


async def panel_clean(s):
    txt = await s.page.inner_text('#panel')
    for bad in ('NaN', 'Infinity', 'undefined', 'null'):
        assert bad not in txt, (bad, txt)
    return txt


COMPARE = """(sc) => {
    if (sc === 'rc') __ck.setTime(0);
    const p = __ck.params(), sol = Circuit.solve(sc, p), ids = Object.keys(sol.elems);
    return { ids, got: ids.map(id => __ck.readout(id)), want: ids.map(id => sol.elems[id]),
             sum: __ck.summary(), wsum: { Rtotal: sol.Rtotal, Itotal: sol.Itotal, Vterm: sol.Vterm }, cur: __ck.current() }; }"""


def check_compare(sc, r):
    assert r['cur'] == sc, r['cur']
    for eid, g, w in zip(r['ids'], r['got'], r['want']):
        for k in ('I', 'V', 'P'):
            assert close(g[k], w[k]), (sc, eid, k, g, w)
    for k, w in r['wsum'].items():
        g = r['sum'][k]
        assert (g is None) if w is None else close(g, w), (sc, k, g, w)


async def test_scenes_match_solver():
    s = await open_sim()
    try:
        for sc in SCENES:
            await s.page.evaluate("(sc) => __ck.scene(sc)", sc)
            check_compare(sc, await s.page.evaluate(COMPARE, sc))
            # and with non-default values
            await s.page.evaluate("""() => { __ck.setParam('eps', 9.5); __ck.setParam('r', 1.2); __ck.setParam('R1', 3.3);
                __ck.setParam('R2', 7.5); __ck.setParam('R3', 15); __ck.setParam('eps2', 4.5); __ck.setParam('C', 4.7e-4); }""")
            check_compare(sc, await s.page.evaluate(COMPARE, sc))
            await panel_clean(s)
        txt = await panel_clean(s)
        assert 'เชิงคุณภาพ' in txt and 'ช้ากว่า' in txt, txt
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_wire_height_is_potential():
    s = await open_sim()
    try:
        r = await s.page.evaluate("""() => { __ck.scene('mixed');
            const v = Circuit.solve('mixed', __ck.params()).v;
            return { v, h: v.map((_, n) => __ck.wireHeight(n)) }; }""")
        v, h = r['v'], r['h']
        f = h[1] / v[1]
        assert f > 0, r
        for vn, hn in zip(v, h):
            if abs(vn) < 1e-12:
                assert abs(hn) < 1e-9, r
            else:
                assert abs(hn / vn / f - 1) <= 0.005, r
        assert h[1] == max(h), ('battery + node is the highest', r)
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_junction_ratio():
    s = await open_sim()
    try:
        r = await s.page.evaluate("""() => { __ck.scene('parallel'); __ck.setParam('R2', 1000); __ck.setParam('R3', 1);
            const sol = Circuit.solve('parallel', __ck.params());
            return { p: __ck.params(), s: ['R1', 'R2', 'R3', 'eps'].map(id => __ck.markerSpeed(id)),
                     I: ['R1', 'R2', 'R3', 'eps'].map(id => sol.elems[id].I) }; }""")
        assert r['p']['R2'] == 1000 and r['p']['R3'] == 1, r['p']
        s1, s2, s3, se = r['s']
        I1, I2, I3, Ie = r['I']
        assert s2 > 0, r
        assert abs((s2 / s3) / (I2 / I3) - 1) <= 0.05, r
        assert abs((s1 / s3) / (I1 / I3) - 1) <= 0.05, r
        # nothing is used up at the junction: the main wire carries the sum of the branches
        assert abs(se - (s1 + s2 + s3)) <= 0.005 * se, r
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_extreme_sliders():
    s = await open_sim()
    try:
        for sc in SCENES:
            btn = s.page.locator('#panel .ck-scenes button[data-v="%s"]' % sc)
            await btn.click()
            names = await s.page.evaluate("""() => [...document.querySelectorAll('#panel input[type=range][data-p]')]
                .filter(e => e.offsetParent !== null).map(e => e.dataset.p)""")
            assert names, sc
            for name in names:
                for end in ('min', 'max'):
                    r = await s.page.evaluate("""([name, end, sc]) => {
                        const el = document.querySelector('#panel input[data-p="' + name + '"]');
                        el.value = el[end]; el.dispatchEvent(new Event('input', { bubbles: true }));
                        const net = Circuit.build(sc, __ck.params());
                        return { p: __ck.params()[name], lim: parseFloat(el[end]),
                                 sp: net.elems.map(e => __ck.markerSpeed(e.id)),
                                 h: Array.from({ length: net.nodes }, (_, n) => __ck.wireHeight(n)),
                                 ro: net.elems.map(e => __ck.readout(e.id)) }; }""", [name, end, sc])
                    vals = r['sp'] + r['h'] + [x[k] for x in r['ro'] for k in ('I', 'V', 'P')]
                    assert all(isinstance(x, (int, float)) and abs(x) < 1e300 for x in vals), (sc, name, end, r)
                    await panel_clean(s)
            if sc in ('single', 'series'):
                rmin = await s.page.evaluate("() => parseFloat(document.querySelector('#panel input[data-p=\"r\"]').min)")
                assert rmin > 0, rmin
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_twoloop_reversed_current():
    s = await open_sim()
    try:
        r = await s.page.evaluate("""() => { __ck.scene('twoloop'); __ck.setParam('eps', 12); __ck.setParam('eps2', 3); __ck.pick('eps2');
            const sol = Circuit.solve('twoloop', __ck.params());
            return { ro: __ck.readout('eps2'), want: sol.elems.eps2.I, sp: __ck.markerSpeed('eps2'), sp1: __ck.markerSpeed('eps'),
                     txt: document.querySelector('#panel .ck-pick [data-k="I"]').textContent,
                     title: document.querySelector('#panel .ck-pick .ro-title').textContent,
                     dir: document.querySelector('#panel .ck-dir').textContent }; }""")
        assert r['ro']['I'] < 0 and close(r['ro']['I'], r['want']), r
        assert r['txt'].strip().startswith('−'), r
        assert 'ε₂' in r['title'], r
        assert 'ย้อน' in r['dir'], r
        assert r['sp'] < 0 < r['sp1'], r
        await panel_clean(s)
        assert not s.errors, s.errors
    finally:
        await s.close()


RC_RUN = """() => { __ck.scene('rc'); __ck.switchTo('charge');
    const p = __ck.params(), tau = (p.R1 + p.r) * p.C, td = p.R1 * p.C, q = () => document.querySelector('#panel [data-k="tau"]').textContent;
    __ck.setTime(tau); const a = __ck.rc(), ta = q();
    __ck.setTime(60 * tau); __ck.switchTo('discharge'); const b0 = __ck.rc();
    __ck.setTime(td); const b = __ck.rc(), tb = q();
    return { p, tau, td, a, ta, b0, b, tb }; }"""


async def test_rc_curve():
    s = await open_sim()
    try:
        r = await s.page.evaluate(RC_RUN)
        import math
        p = r['p']
        Q = p['C'] * p['eps']
        assert close(r['a']['q'], Q * (1 - 1 / math.e)), r
        assert close(r['a']['tau'], r['tau']), r
        assert close(parse_si(r['ta'], 's'), r['tau']), r['ta']
        assert close(r['b0']['q'], Q), r
        assert close(r['b']['q'], r['b0']['q'] / math.e), r
        assert close(r['b']['tau'], r['td']), r
        assert close(parse_si(r['tb'], 's'), r['td']), r['tb']
        assert r['b']['mode'] == 'discharge' and r['a']['mode'] == 'charge', r
        await panel_clean(s)
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_rc_restart_on_change():
    s = await open_sim()
    try:
        await s.page.evaluate("() => { __ck.scene('rc'); __ck.switchTo('charge'); }")
        await s.page.wait_for_timeout(1000)
        r = await s.page.evaluate("""() => { const t0 = __ck.rc().t;
            const el = document.querySelector('#panel input[data-p="C"]');
            el.value = parseFloat(el.value) + 0.3; el.dispatchEvent(new Event('input', { bubbles: true }));
            const p = __ck.params();
            return { t0, t1: __ck.rc().t, tau: __ck.rc().tau, want: (p.R1 + p.r) * p.C,
                     msg: document.querySelector('#panel .ck-msg').textContent }; }""")
        assert r['t0'] > 0, r
        assert r['t1'] == 0, r
        assert close(r['tau'], r['want']), r
        assert 'เริ่มจับเวลาใหม่' in r['msg'], r
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_scene_switch_and_leave():
    s = await open_sim()
    try:
        async def settled():
            f = await s.page.evaluate("() => __ck.frames()")
            await s.page.wait_for_function("(f) => __ck.frames() >= f + 5", arg=f)
            return await s.page.evaluate("() => __ck.mem()")
        async def cycle():                      # every scene really drawn, ending on 'mixed'
            for sc in SCENES + ['mixed']:
                await s.page.evaluate("(sc) => __ck.scene(sc)", sc)
                await settled()
            return await settled()
        # headless Chrome here may lose and restore the WebGL context just after load: take the baseline later
        await s.page.wait_for_timeout(1500)
        m0 = await cycle()
        await s.page.evaluate("""() => { const sc = ['single', 'series', 'parallel', 'mixed', 'twoloop', 'rc'];
            for (let k = 0; k < 20; k++) document.querySelector('#panel .ck-scenes button[data-v="' + sc[k % 6] + '"]').click();
            document.querySelector('#panel .ck-scenes button[data-v="mixed"]').click(); }""")
        m1 = await settled()
        m2 = await cycle()
        assert m2 == m0, ('no GPU resources leak across rendered scene switches', m0, m2)
        assert m1 == m0, ('no GPU resources leak across scene switches', m0, m1)
        # every geometry, material and texture the lab owns is freed when the page is left
        n = await s.page.evaluate("""() => { window.__ckFreed = new Set(); const res = __ck._owned();
            res.forEach((x, i) => x.addEventListener('dispose', () => { window.__ckFreed.add(i); })); return res.length; }""")
        assert n > 10, n
        await s.page.evaluate("() => { location.hash = '#circuit'; }")
        await s.page.wait_for_timeout(500)
        assert await s.page.evaluate("() => document.querySelectorAll('canvas').length") <= 1
        assert await s.page.evaluate("() => window.__ckFreed.size") == n
        assert await s.page.evaluate("() => !window.__ck")
        assert not s.errors, s.errors
        await s.page.evaluate("() => { location.hash = '#circuit-sim'; }")
        await s.page.wait_for_selector('#stage canvas')
        await s.page.wait_for_function("() => window.__ck && __ck.ready && __ck.ready()")
        check_compare('mixed', await s.page.evaluate(COMPARE, 'mixed'))
        await s.page.wait_for_timeout(300)
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_theme_switch():
    s = await open_sim()
    try:
        c0 = await s.page.evaluate("() => { __ck.scene('parallel'); __ck.setParam('R2', 12); return __ck.colors(); }")
        await s.page.click('#themeBtn')
        await s.page.wait_for_timeout(400)
        await s.page.wait_for_function("() => window.__ck && __ck.ready && __ck.ready()")
        r = await s.page.evaluate("() => ({ c: __ck.colors(), sc: __ck.current(), R2: __ck.params().R2, n: document.querySelectorAll('#stage canvas').length })")
        assert r['n'] == 1 and r['c'] != c0, (c0, r)
        assert r['sc'] == 'parallel' and r['R2'] == 12, r
        await s.page.click('#themeBtn')
        await s.page.wait_for_timeout(400)
        c2 = await s.page.evaluate("() => __ck.colors()")
        assert c2 == c0, (c0, c2)
        await panel_clean(s)
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_mobile_layout():
    s = await open_sim(viewport=(390, 844))
    try:
        assert await s.page.evaluate("() => document.documentElement.scrollWidth") <= 390
        boxes = await s.page.evaluate("""() => [...document.querySelectorAll('#panel button, #panel input')]
            .filter(b => b.offsetParent !== null).map(b => { const r = b.getBoundingClientRect(); return [r.left, r.right, r.width]; })""")
        assert boxes and all(b[0] >= 0 and b[1] <= 390 and b[2] > 0 for b in boxes), boxes
        btn = s.page.locator('#panel .ck-scenes button[data-v="twoloop"]')
        await btn.scroll_into_view_if_needed()
        await btn.click()
        assert await s.page.evaluate("() => __ck.current()") == 'twoloop'
        chip = s.page.locator('#panel .ck-chips button[data-id="R3"]')
        await chip.scroll_into_view_if_needed()
        await chip.click()
        assert await s.page.evaluate("() => __ck.selected()") == 'R3'
        await s.page.locator('#panel .ck-scenes button[data-v="rc"]').click()
        assert await s.page.evaluate("() => __ck.current()") == 'rc'
        assert await s.page.evaluate("() => document.documentElement.scrollWidth") <= 390
        await panel_clean(s)
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_pick_by_pointer():
    s = await open_sim()
    try:
        p = await s.page.evaluate("() => { __ck.scene('mixed'); return __ck.screenOf('R3'); }")
        await s.page.mouse.click(p['x'], p['y'])
        r = await s.page.evaluate("() => ({ sel: __ck.selected(), title: document.querySelector('#panel .ck-pick .ro-title').textContent })")
        assert r['sel'] == 'R3' and 'R₃' in r['title'], r
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_fps_drag():
    s = await open_sim()
    try:
        e0 = await s.page.evaluate("() => { __ck.scene('mixed'); return __ck.params().eps; }")
        await s.page.locator('#panel input[data-p="eps"]').scroll_into_view_if_needed()
        box = await s.page.locator('#panel input[data-p="eps"]').bounding_box()
        f0 = await s.page.evaluate("() => __ck.frames()")
        y = box['y'] + box['height'] / 2
        await s.page.mouse.move(box['x'] + 4, y)
        await s.page.mouse.down()
        for k in range(20):
            await s.page.mouse.move(box['x'] + 4 + (box['width'] - 8) * (k + 1) / 20, y)
            await s.page.wait_for_timeout(50)
        await s.page.mouse.up()
        f1 = await s.page.evaluate("() => __ck.frames()")
        assert f1 - f0 >= 10, ('frames while moving a slider for 1 s', f1 - f0)
        assert await s.page.evaluate("() => __ck.params().eps") != e0
        check_compare('mixed', await s.page.evaluate(COMPARE, 'mixed'))
        assert not s.errors, s.errors
    finally:
        await s.close()


run_tests(globals())
