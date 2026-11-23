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
        await s.page.wait_for_selector('.px-row')          # Task 5: the practice set replaced the placeholder
        assert 'แบบฝึกหัดบทนี้กำลังจัดทำ' not in await s.page.inner_text('#tabview')
        dots = await s.page.evaluate("() => [...document.querySelectorAll('.px-row')].map(r => r.querySelectorAll('.px-dot').length)")
        assert dots == [7, 7, 6], dots
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


# ───────────── review fixes: test what is drawn and displayed ─────────────

KH = 0.25          # 1 scene unit of height = 4 V (stated in the panel note)

# Independent truth for the current state: Circuit.solve (DC scenes) or Circuit.rcState (RC, charging from empty),
# plus everything the lab has drawn (__ck.edges(): instance matrices, plates, markers).
DRAWN = """(sc) => {
    const p = __ck.params(); let v, el, sum;
    if (sc === 'rc') {
        const t = __ck.rc().t, s = Circuit.rcState(p, 'charge', t), i = s.i;
        v = { 0: 0, 1: p.eps, A: p.eps - i * p.r, 2: p.eps - i * p.r, 3: s.vC };
        el = { eps: { I: i, V: -p.eps }, r: { I: i, V: i * p.r }, R1: { I: i, V: i * p.R1 }, C: { I: i, V: s.vC } };
        sum = { Rtotal: p.R1, Itotal: i, Vterm: p.eps - i * p.r, t, tau: Circuit.tau(p, 'charge'), q: s.q, vC: s.vC, i };
    } else {
        const sol = Circuit.solve(sc, p); v = {}; sol.v.forEach((x, n) => { v[n] = x; }); el = sol.elems;
        sum = { Rtotal: sol.Rtotal, Itotal: sol.Itotal, Vterm: sol.Vterm };
    }
    return { p, v, el, sum, edges: __ck.edges(), spacing: __ck.spacing, elapsed: __ck.elapsed() }; }"""


def key(pt):
    return (round(pt[0], 6), round(pt[1], 6))


def check_kcl(sc, d):
    node = {}
    imax = max(abs(e['I']) for e in d['edges'])
    for e in d['edges']:
        a, b = key(e['pts'][0]), key(e['pts'][-1])
        node[a] = node.get(a, 0) - e['I']
        node[b] = node.get(b, 0) + e['I']
        if e['kind'] == 'elem':
            w = d['el'][e['id']]['I']
            assert abs(e['I'] - w) <= 1e-9 * max(1, abs(w)), (sc, e['id'], e['I'], w)
    for pt, s in node.items():
        assert abs(s) <= 1e-9 * max(1, imax), ('current in = current out', sc, pt, s)


def check_heights(sc, d):
    seen = {}
    for e in d['edges']:
        pts, nodes = e['pts'], e['nodes']
        for k, sg in enumerate(e['segs']):
            for (x, y, z), pt, n in ((sg[:3], pts[k], nodes[k]), (sg[3:], pts[k + 1], nodes[k + 1])):
                assert abs(x - pt[0]) < 1e-4 and abs(z + pt[1]) < 1e-4, ('drawn where laid out', sc, e['id'], (x, z), pt)
                assert abs(y - KH * d['v'][str(n)]) < 1e-4, ('drawn height = KH·V', sc, e['id'], n, y, d['v'][str(n)])
                seen.setdefault(key(pt), []).append(y)
        if e['kind'] == 'elem':
            ya, yb = e['segs'][0][1], e['segs'][-1][4]
            assert abs((ya - yb) - KH * d['el'][e['id']]['V']) < 1e-4, ('drop across element', sc, e['id'], ya, yb)
            if e['id'] == 'eps':
                assert abs(ya) < 1e-6, ('negative pole at 0 V', sc, ya)
    for pt, ys in seen.items():
        assert max(ys) - min(ys) < 1e-4, ('one height where pieces meet', sc, pt, ys)


def arc_of(e, m):
    """floor arc position of a marker along the edge polyline, and the drawn height there"""
    best = None
    for k in range(len(e['pts']) - 1):
        (ax, ay), (bx, by) = e['pts'][k], e['pts'][k + 1]
        az, bz = -ay, -by
        dx, dz = bx - ax, bz - az
        L2 = dx * dx + dz * dz
        u = max(0, min(1, ((m[0] - ax) * dx + (m[2] - az) * dz) / L2)) if L2 else 0
        dist = ((ax + u * dx - m[0]) ** 2 + (az + u * dz - m[2]) ** 2) ** 0.5
        if best is None or dist < best[0]:
            y0, y1 = e['segs'][k][1], e['segs'][k][4]
            best = (dist, sum(((e['pts'][j + 1][0] - e['pts'][j][0]) ** 2 + (e['pts'][j + 1][1] - e['pts'][j][1]) ** 2) ** 0.5
                              for j in range(k)) + u * L2 ** 0.5, y0 + u * (y1 - y0))
    return best


def check_markers(sc, d):
    sp = d['spacing']
    for e in d['edges']:
        if e['id'] == 'C':
            assert not e['markers'], 'no markers across the capacitor gap'
            continue
        ph = e['off'] % sp
        want = [ph + k * sp for k in range(int(e['L'] / sp) + 2) if ph + k * sp < e['L'] - 1e-6]
        rows = []
        for m in e['markers']:
            dist, sa, ya = arc_of(e, m)
            rows.append((sa, ya, m[1], dist))
        rows.sort()
        assert all(r[3] < 1e-3 for r in rows), ('markers on the wire', sc, e['id'])
        assert all(abs(r[1] - r[2]) < 1e-3 for r in rows), ('markers at the drawn height', sc, e['id'])
        s = [r[0] for r in rows]
        assert len(s) in (len(want), len(want) + 1) and all(abs(a - b) < 2e-3 for a, b in zip(s, want)), ('one spacing, phase = off', sc, e['id'], s, want)


async def drawn(s, sc):
    return await s.page.evaluate(DRAWN, sc)


async def test_drawn_kcl_heights_markers():
    s = await open_sim()
    try:
        cases = [(sc, None) for sc in SCENES if sc != 'rc'] + [('twoloop', "() => { __ck.setParam('eps', 12); __ck.setParam('eps2', 3); }"),
                 ('parallel', "() => { __ck.setParam('R2', 1000); __ck.setParam('R3', 1); }"),
                 ('rc', "() => { __ck.switchTo('charge'); const p = __ck.params(); __ck.setTime((p.R1 + p.r) * p.C); }"),
                 ('rc', "() => { const p = __ck.params(); __ck.setTime(0.3 * (p.R1 + p.r) * p.C); }")]
        for sc, setup in cases:
            await s.page.evaluate("(sc) => __ck.scene(sc)", sc)
            if setup:
                await s.page.evaluate(setup)
            d = await drawn(s, sc)
            if sc == 'twoloop' and setup:
                assert d['el']['eps2']['I'] < 0, d['el']['eps2']
            check_kcl(sc, d)
            check_heights(sc, d)
            check_markers(sc, d)
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_markers_move_with_current():
    """every marker stream advances by K·I·dt with one K for the whole circuit (so markers/second ∝ I everywhere)"""
    s = await open_sim()
    try:
        for sc, setup in [('mixed', None), ('twoloop', "() => __ck.setParam('eps2', 3)"), ('parallel', "() => { __ck.setParam('R2', 1000); __ck.setParam('R3', 1); }")]:
            await s.page.evaluate("(sc) => __ck.scene(sc)", sc)
            if setup:
                await s.page.evaluate(setup)
            d0 = await drawn(s, sc)
            await s.page.wait_for_timeout(600)
            d1 = await drawn(s, sc)
            dt = d1['elapsed'] - d0['elapsed']
            assert dt > 0.1, dt
            imax = max(abs(e['I']) for e in d0['edges'])
            ks = []
            for e0, e1 in zip(d0['edges'], d1['edges']):
                if e0['id'] == 'C' or abs(e0['I']) < 1e-6 * imax:
                    continue
                ks.append((e1['off'] - e0['off']) / (e0['I'] * dt))
            assert ks and min(ks) > 0, ('markers move along +I', sc, ks)
            assert max(ks) - min(ks) <= 1e-6 * max(ks), ('one speed scale K for every wire', sc, min(ks), max(ks))
            check_markers(sc, d1)
        assert not s.errors, s.errors
    finally:
        await s.close()


def parse_row(txt, unit):
    return parse_si(txt, unit)


def near(a, b, rel=0.006):
    return abs(a - b) <= rel * abs(b) + 1e-9


PANEL = """() => { const g = k => document.querySelector('#panel .ck-pick [data-k="' + k + '"]').textContent;
    const w = k => document.querySelector('#panel [data-k="' + k + '"]').textContent;
    return { I: g('I'), V: g('V'), P: g('P'), Rt: w('Rt'), It: w('It'), Vt: w('Vt'),
             tau: w('tau'), q: w('q'), vc: w('vc'), i: w('i') }; }"""


async def test_panel_numbers_match_solver():
    s = await open_sim()
    try:
        await s.page.click('#tPlay')                 # pause: the RC clock must not move while the panel is read
        cases = [(sc, None) for sc in SCENES if sc != 'rc'] + [('twoloop', "() => __ck.setParam('eps2', 3)"),
                 ('series', "() => { __ck.setParam('R1', 330); __ck.setParam('r', 0.05); }"),
                 ('rc', "() => { const p = __ck.params(); __ck.setTime((p.R1 + p.r) * p.C); }")]
        for sc, setup in cases:
            await s.page.evaluate("(sc) => __ck.scene(sc)", sc)
            if setup:
                await s.page.evaluate(setup)
            d = await drawn(s, sc)
            p, el, sm = d['p'], d['el'], d['sum']
            for e in d['edges']:
                await s.page.evaluate("(id) => __ck.pick(id)", e['id'])
                t = await s.page.evaluate(PANEL)
                I = parse_row(t['I'], 'A')
                if e['kind'] == 'wire':
                    assert near(I, e['I']), (sc, e['id'], t['I'], e['I'])
                    assert near(parse_row(t['V'], 'V'), d['v'][str(e['nodes'][0])]), (sc, e['id'], t['V'])
                    continue
                eid, x = e['id'], el[e['id']]
                assert near(I, x['I']), (sc, eid, t['I'], x['I'])
                if eid in ('eps', 'eps2'):
                    V, P = p[eid] - x['I'] * p['r'], p[eid] * x['I']
                elif eid == 'C':
                    V, P = x['V'], x['V'] * x['I']
                else:
                    R = p['r'] if eid in ('r', 'r2') else p[eid]
                    V, P = x['I'] * R, x['I'] ** 2 * R
                assert near(parse_row(t['V'], 'V'), V), (sc, eid, t['V'], V)
                assert near(parse_row(t['P'], 'W'), P), (sc, eid, t['P'], P)
            if sm['Rtotal'] is None:
                assert t['Rt'].strip() == '—', t['Rt']
            else:
                assert near(parse_row(t['Rt'], 'Ω'), sm['Rtotal']), (sc, t['Rt'], sm['Rtotal'])
            assert near(parse_row(t['It'], 'A'), sm['Itotal']), (sc, t['It'], sm['Itotal'])
            assert near(parse_row(t['Vt'], 'V'), sm['Vterm']), (sc, t['Vt'], sm['Vterm'])
            if sc == 'rc':
                for k, u in (('tau', 's'), ('q', 'C'), ('vc', 'V'), ('i', 'A')):
                    assert near(parse_row(t[k], u), sm[{'vc': 'vC'}.get(k, k)]), (k, t[k], sm)
        txt = await panel_clean(s)
        assert 'ความต่างศักย์ระหว่างขั้ว' in txt and 'V ระหว่างขั้ว' not in txt, txt
        assert 'ทิศกระแสตามข้อตกลง' in txt and 'สมมติ' not in txt and 'สมมุติ' not in txt, txt
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_wire_readout_by_pointer():
    s = await open_sim()
    try:
        d = await s.page.evaluate("() => { __ck.scene('series'); return { e: __ck.edges(), v: Circuit.solve('series', __ck.params()).v, I: Circuit.solve('series', __ck.params()).elems.R1.I }; }")
        r1 = next(e for e in d['e'] if e['id'] == 'R1')
        before = next(e for e in d['e'] if e['kind'] == 'wire' and key(e['pts'][-1]) == key(r1['pts'][0]))
        after = next(e for e in d['e'] if e['kind'] == 'wire' and key(e['pts'][0]) == key(r1['pts'][-1]))
        got = []
        for w in (before, after):
            p = await s.page.evaluate("(i) => __ck.screenOfEdge(i)", w['i'])
            await s.page.mouse.click(p['x'], p['y'])
            sel = await s.page.evaluate("() => __ck.selected()")
            assert sel == w['id'], ('tapped the wire section', sel, w['id'])
            t = await s.page.evaluate(PANEL)
            title = await s.page.inner_text('#panel .ck-pick .ro-title')
            assert 'สาย' in title, title
            got.append((t['I'], parse_row(t['I'], 'A'), parse_row(t['V'], 'V')))
        assert got[0][0] == got[1][0], ('same current before and after R₁', got)
        assert near(got[0][1], d['I']), (got, d['I'])
        assert near(got[0][2], d['v'][r1['nodes'][0]]) and near(got[1][2], d['v'][r1['nodes'][1]]), (got, d['v'])
        assert got[0][2] > got[1][2], ('potential drops across R₁, current does not', got)
        assert not s.errors, s.errors
    finally:
        await s.close()


# ───────────── Task 4: lecture content and worked examples ─────────────

# one short Thai key phrase per misconception of spec §6.2, each must sit in a misconception box (.check .x)
MISCONCEPTIONS = {
    's1': ['ใช้หมดไป', 'จ่ายกระแสคงที่', 'เท่ากันเสมอ', 'เร็วเท่าแสง'],
    's2': ['R ขึ้นกับ', 'ทุกสิ่ง'],
    's3': ['ความต้านทานรวมเพิ่ม', 'หลอดแรก', 'สูตรของตัวเก็บประจุ'],
    's4': ['ทวนทิศกระแส', 'ติดลบ'],
    's5': ['วัตต์สูง', 'เต็มทันที', 'เส้นตรง'],
}


async def test_lecture_content():
    """Task 4: five sections, each with a worked example (>= 2 steps) and a misconception box; every §6.2 misconception
    named in a box; the key relations by their MathJax source; e stated in every example that uses it; links back to
    estat s4/s5 and forward to nuclear s3; no Thai inside \\text{}; no magnetism; "สมมุติ" only in s4; MathJax clean;
    every worked example fully opened fits a 390 px phone."""
    import re
    s = await open_page('circuit', viewport=(390, 844))
    try:
        await s.page.wait_for_selector('#lec .wx .wx-next')
        raw = await s.page.evaluate("() => document.getElementById('lec-circuit').innerHTML")
        assert 'กำลังจัดทำ' not in raw, 'placeholder text left'
        for frag in ('I = \\dfrac{Q}{t}', 'V = \\varepsilon - Ir', 'R = \\dfrac{\\rho L}{A}', '\\dfrac{V^2}{R}',
                     '\\tau = (R + r)C', '\\tau = RC', 'e^{-t/\\tau}'):
            assert frag in raw, frag
        bad = re.findall(r'\\text\{[^}]*[\u0E00-\u0E7F][^}]*\}', raw)
        assert not bad, bad
        r = await s.page.evaluate("""() => {
            const lec = document.querySelector('#lec'); const out = []; let cur = null;
            for (const el of lec.querySelectorAll('h2, .wx, .check, p, li, .feyn')) {
                if (el.tagName === 'H2') { cur = { id: el.id, wx: [], x: [], text: '' }; out.push(cur); continue; }
                if (!cur) continue;
                if (el.classList.contains('wx')) cur.wx.push({ n: el.querySelectorAll('.wx-steps > li').length,
                    q: el.querySelector('.wx-q').innerHTML, all: el.innerHTML });
                else if (el.classList.contains('check')) cur.x.push(el.querySelector('.x').textContent);
                cur.text += ' ' + el.textContent;
            }
            const hrefs = [...lec.querySelectorAll('a')].map(a => a.getAttribute('href'));
            return { secs: out, sum: !!lec.querySelector('.sumbox'), hrefs,
                     text: lec.textContent, nuc: !!document.querySelector('#lec-nuclear').content.querySelector('h2#s3') }; }""")
        assert [x['id'] for x in r['secs']] == ['s1', 's2', 's3', 's4', 's5'], r['secs']
        for sec in r['secs']:
            assert sec['wx'] and all(w['n'] >= 2 for w in sec['wx']), (sec['id'], [w['n'] for w in sec['wx']])
            assert sec['x'], ('misconception box', sec['id'])
            for key in MISCONCEPTIONS[sec['id']]:
                assert any(key in x for x in sec['x']), ('misconception not in a box', sec['id'], key, sec['x'])
            for w in sec['wx']:
                if '1.6\\times10^{-19}' in w['all']:
                    assert '1.6\\times10^{-19}' in w['q'], ('e stated in the question', sec['id'], w['q'][:80])
            if sec['id'] != 's4':
                assert 'สมมุติ' not in sec['text'] and 'สมมติ' not in sec['text'], ('"สมมุติ" is reserved for s4', sec['id'])
        assert 'ทิศที่สมมุติ' in r['secs'][3]['text'], 's4 names the assumed direction'
        assert r['sum'], 'formula box'
        for h in ('#circuit-sim', '#estat?s=s4', '#estat?s=s5'):
            assert h in r['hrefs'], (h, r['hrefs'])
        assert r['nuc'] and '#nuclear?s=s3' in r['hrefs'], r['hrefs']
        for term in ('แรงเคลื่อนไฟฟ้า', 'ความต่างศักย์ระหว่างขั้ว', 'ความต้านทานภายใน', 'กระแสตามข้อตกลง'):
            assert term in r['text'], term
        for banned in ('แม่เหล็ก', 'เหนี่ยวนำ', 'V ระหว่างขั้ว'):
            assert banned not in r['text'], banned
        n = await s.page.locator('#lec .wx').count()
        for i in range(n):
            wx = s.page.locator('#lec .wx').nth(i)
            for _ in range(12):
                if not await wx.locator('.wx-next').count():
                    break
                await wx.locator('.wx-next').click()
            assert await wx.locator('.wx-next').count() == 0, i
        await s.page.evaluate("() => (window.MathJax && MathJax.startup && MathJax.startup.promise) || null")
        await s.page.wait_for_timeout(800)
        m = await s.page.evaluate("""() => ({
            sw: document.documentElement.scrollWidth,
            merr: document.querySelectorAll('#lec mjx-merror, #lec [data-mjx-error]').length,
            raw: (document.querySelector('#lec').innerText.match(/\\\\[(\\[]/g) || []).length,
            hidden: document.querySelectorAll('#lec .wx-steps > li[hidden]').length,
            wide: [...document.querySelectorAll('#lec mjx-container, #lec svg.circ')]
                .filter(x => x.getBoundingClientRect().right > window.innerWidth + 0.5).map(x => x.textContent.slice(0, 40)) })""")
        assert m['hidden'] == 0 and m['merr'] == 0 and m['raw'] == 0, m
        assert m['sw'] <= 390 and not m['wide'], m
        assert not s.errors, s.errors
    finally:
        await s.close()


# ───────────── Task 6: cross-links ─────────────

async def section_top(s, sec):
    return await s.page.evaluate("""(id) => { const h = document.querySelector('#lec #' + id);
        return h ? [h.getBoundingClientRect().top, innerHeight] : null; }""", sec)


async def test_cross_links():
    # estat s5 -> circuit s5 (RC) and s3 (series/parallel contrast); circuit s1 -> estat s4
    for src, href, dest, sec in [('estat', '#circuit?s=s5', '#circuit', 's5'),
                                 ('estat', '#circuit?s=s3', '#circuit', 's3'),
                                 ('circuit', '#estat?s=s4', '#estat', 's4')]:
        s = await open_page(src)
        try:
            sel = '.lec a[href="%s"]' % href
            await s.page.wait_for_selector(sel, state='attached')
            loc = s.page.locator(sel).first
            await loc.scroll_into_view_if_needed()
            await loc.click()
            await s.page.wait_for_timeout(1200)
            assert await s.page.evaluate("() => location.hash") == href
            tab = await s.page.evaluate("() => document.querySelector('.tabs a.on').getAttribute('href')")
            assert tab == dest, tab
            st = await section_top(s, sec)
            assert st and 64 <= st[0] < st[1], (sec, st)
            assert not s.errors, s.errors
        finally:
            await s.close()


run_tests(globals())
