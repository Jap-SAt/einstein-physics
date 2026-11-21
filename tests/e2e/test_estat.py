"""Browser tests for the electrostatics chapter: registration (Task 2) and the electric-field lab (Task 3).
Run: python3 tests/e2e/test_estat.py [test_name ...]"""
import os
from harness import open_page, run_tests, ROOT

PART = """localStorage.setItem('einstein_practice_particle', JSON.stringify({v:1, items:{}}));"""


async def test_home_order():
    s = await open_page('home')
    try:
        r = await s.page.evaluate("""() => [...document.querySelectorAll('a.pick')].map(a => ({
            href: a.getAttribute('href'), t: a.querySelector('.t').childNodes[0].textContent.trim() }))""")
        hrefs = [x['href'] for x in r]
        assert hrefs == ['#mech', '#thermo', '#waves', '#estat', '#particle', '#em', '#atom', '#nuclear'], hrefs
        mods = await s.page.evaluate("() => MODS.map(m => [m.id, m.no, m.title])")
        assert [m[1] for m in mods] == ['0%d' % i for i in range(1, 9)], mods
        by = {m[0]: m for m in mods}
        assert by['estat'][1] == '04' and by['estat'][2] == 'ไฟฟ้าสถิต', by['estat']
        assert by['particle'][1] == '05', by['particle']
        assert by['waves'][2] == 'คลื่นและทัศนศาสตร์'
        sub = await s.page.evaluate("() => document.querySelector('a.pick[href=\"#estat\"] .s').textContent.trim()")
        assert sub == 'ประจุ · กฎของคูลอมบ์ · สนามและศักย์ · ตัวเก็บประจุ', sub
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_old_links_and_progress():
    rec = """localStorage.setItem('einstein_practice_particle', JSON.stringify({v:1, items:{}}));"""
    # find a real item id first
    s = await open_page('home')
    try:
        iid = await s.page.evaluate("() => PRACTICE.particle[0].id")
    finally:
        await s.close()
    init = ("localStorage.setItem('einstein_practice_particle', JSON.stringify({v:1, items:{'%s':{s:'ok',n:1,t:1}}}));" % iid)
    s = await open_page('particle', init_script=init)
    try:
        h1 = await s.page.inner_text('.lec h1')
        assert h1 == 'อนุภาคในสนามแม่เหล็ก', h1
        await s.page.goto(s.page.url.split('#')[0] + '#particle-quiz')
        await s.page.wait_for_selector('.px-row')
        n = await s.page.evaluate("() => document.querySelectorAll('.px-dot.ok').length")
        assert n == 1, n
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_estat_tabs():
    s = await open_page('estat')
    try:
        ids = await s.page.evaluate("() => [...document.querySelectorAll('.lec h2')].map(h => h.id)")
        assert ids == ['s1', 's2', 's3', 's4', 's5'], ids
        tx = await s.page.evaluate("() => [...document.querySelectorAll('.lec h2')].map(h => h.textContent.replace(/^\\d+/, ''))")
        assert tx == ['ประจุไฟฟ้า', 'กฎของคูลอมบ์', 'สนามไฟฟ้า', 'ศักย์และความต่างศักย์', 'ตัวเก็บประจุ'], tx
        nxt = await s.page.inner_text('.nextcards')
        assert 'undefined' not in nxt and 'NaN' not in nxt, nxt
        assert not s.errors, s.errors
        await s.page.goto(s.page.url.split('#')[0] + '#estat-sim')
        await s.page.wait_for_selector('#stage canvas')
        assert 'ห้องทดลองสนามไฟฟ้า' in await s.page.inner_text('#panel')
        await s.page.click('#tPlay')
        await s.page.goto(s.page.url.split('#')[0] + '#estat-quiz')
        await s.page.wait_for_timeout(300)
        assert 'แบบฝึกหัดบทนี้กำลังจัดทำ' in await s.page.inner_text('#tabview')
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_no_hardcoded_count():
    s = await open_page('home')
    try:
        txt = await s.page.inner_text('body')
        assert '7 บท' not in txt, 'home text'
        assert await s.page.evaluate("() => document.querySelector('a.pick[href=\"#estat\"] .badge').textContent") == 'ยังไม่เริ่ม'
    finally:
        await s.close()
    html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    assert '7 บท' not in html


# ───────────── Task 3: electric-field lab (#estat-sim) ─────────────

async def open_sim(**kw):
    s = await open_page('estat-sim', **kw)
    await s.page.wait_for_selector('#stage canvas')
    await s.page.wait_for_function("() => window.__ef && __ef.ready && __ef.ready()")
    return s


async def panel_clean(s):
    txt = await s.page.inner_text('#panel')
    for bad in ('NaN', 'Infinity', 'undefined'):
        assert bad not in txt, (bad, txt)
    return txt


async def test_dipole_preset():
    s = await open_sim()
    try:
        r = await s.page.evaluate("() => { __ef.preset('dipole'); return { c: __ef.charges(), l: __ef.lines() }; }")
        c, lines = r['c'], r['l']
        assert len(c) == 2, c
        pi = [i for i, x in enumerate(c) if x['q'] > 0]
        ni = [i for i, x in enumerate(c) if x['q'] < 0]
        assert len(pi) == 1 and len(ni) == 1, c
        p, n = c[pi[0]], c[ni[0]]
        assert len(lines) > 0
        for L in lines:
            f = L['first']
            d = ((f[0] - p['x']) ** 2 + f[1] ** 2 + (f[2] - p['z']) ** 2) ** 0.5
            assert d <= 1.0, (L, p)
            assert L['to'] == ni[0], ('line does not end on the − charge', L)
            e = L['last']
            assert ((e[0] - n['x']) ** 2 + e[1] ** 2 + (e[2] - n['z']) ** 2) ** 0.5 <= 1.0, L
        await panel_clean(s)
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_place_drag_adjust():
    s = await open_sim()
    try:
        r = await s.page.evaluate("""() => {
            __ef.preset('clear');
            __ef.place(0, 0, 1); __ef.place(10, 0, -1);
            __ef.drag(1, 12, 0);
            __ef.setQ(0, 3);
            const ro = __ef.readout(6, 0);
            const ch = __ef.charges().map(c => ({ x: c.x, y: 0, z: c.z, q: c.q }));
            const f = EField.field(ch, { x: 6, y: 0, z: 0 }), v = EField.potential(ch, { x: 6, y: 0, z: 0 });
            return { ro, ch, E: f.mag, V: v, lines: __ef.lines().length };
        }""")
        ch = r['ch']
        assert len(ch) == 2, ch
        assert abs(ch[0]['x']) < 1e-9 and abs(ch[0]['z']) < 1e-9 and abs(ch[0]['q'] - 3) < 1e-9, ch
        assert abs(ch[1]['x'] - 12) < 1e-9 and abs(ch[1]['z']) < 1e-9 and ch[1]['q'] < 0, ch
        assert abs(r['ro']['E'] - r['E']) <= 0.005 * abs(r['E']), r
        assert abs(r['ro']['V'] - r['V']) <= 0.005 * abs(r['V']), r
        assert r['lines'] > 0
        txt = await panel_clean(s)
        assert 'N/C' in txt and 'cm' in txt, txt
        # the panel shows the same |E| (mantissa × 10^exp)
        etxt = await s.page.evaluate("() => document.querySelector('[data-k=\"E\"]').textContent")
        sup = str.maketrans('⁰¹²³⁴⁵⁶⁷⁸⁹⁻', '0123456789-')
        m = etxt.replace('N/C', '').strip()
        if '×' in m:
            a, b = m.split('× 10')
            val = float(a) * 10 ** int(b.strip().translate(sup))
        else:
            val = float(m)
        assert abs(val - r['E']) <= 0.01 * r['E'], (etxt, r['E'])
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_readout_at_charge():
    s = await open_sim()
    try:
        r = await s.page.evaluate("() => { __ef.preset('dipole'); const c = __ef.charges()[0]; return __ef.readout(c.x, c.z); }")
        for k in ('E', 'V'):
            v = r[k]
            assert v is None or (isinstance(v, (int, float)) and abs(v) < 1e300), r
        txt = await panel_clean(s)
        for k in ('E', 'V'):
            t = await s.page.evaluate("(k) => document.querySelector('[data-k=\"' + k + '\"]').textContent", k)
            assert t.strip() == '—' or any(ch.isdigit() for ch in t), t
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_clear_and_negative_only():
    s = await open_sim()
    try:
        r = await s.page.evaluate("() => { __ef.preset('clear'); return [__ef.charges().length, __ef.lines().length]; }")
        assert r == [0, 0], r
        await s.page.wait_for_timeout(200)
        await panel_clean(s)
        n = await s.page.evaluate("() => { __ef.place(3, 3, -1); return __ef.lines().length; }")
        assert n > 0, n
        await s.page.wait_for_timeout(200)
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_charge_cap():
    s = await open_sim()
    try:
        n = await s.page.evaluate("""() => { __ef.preset('clear');
            for (let i = 0; i < 9; i++) __ef.place(-16 + 4 * i, (i % 2) * 5, i % 2 ? -1 : 1);
            return __ef.charges().length; }""")
        assert n == 8, n
        msg = await s.page.inner_text('#panel .ef-msg')
        assert '8' in msg and 'ประจุ' in msg, msg
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_floor_matches_formula():
    s = await open_sim()
    try:
        await s.page.evaluate("() => __ef.preset('dipole')")
        await s.page.wait_for_timeout(200)
        pts = await s.page.evaluate("""() => {
            const ch = __ef.charges().map(c => ({ x: c.x, y: 0, z: c.z, q: c.q }));
            const p = ch.find(c => c.q > 0), n = ch.find(c => c.q < 0);
            const mid = { x: (p.x + n.x) / 2, z: (p.z + n.z) / 2 };
            const dx = n.x - p.x, dz = n.z - p.z, L = Math.hypot(dx, dz);
            const P = [
                { x: p.x + dx / L * 2, z: p.z + dz / L * 2 },
                { x: n.x - dx / L * 2, z: n.z - dz / L * 2 },
                { x: mid.x - dz / L * 6, z: mid.z + dx / L * 6 }];
            return P.map(q => ({ q, V: EField.potential(ch, { x: q.x, y: 0, z: q.z }), px: __ef.floorPixel(q.x, q.z) }));
        }""")
        warm, cool, mid = pts
        assert warm['V'] > 0 and warm['px'][0] - warm['px'][2] > 30, warm
        assert cool['V'] < 0 and cool['px'][2] - cool['px'][0] > 30, cool
        assert abs(mid['V']) < 1e-6 * abs(warm['V']), mid
        assert abs(mid['px'][0] - mid['px'][2]) <= 16, mid
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_theme_switch():
    s = await open_sim()
    try:
        c0 = await s.page.evaluate("() => { __ef.preset('pp'); return __ef.floorColors(); }")
        await s.page.click('#themeBtn')
        await s.page.wait_for_timeout(400)
        await s.page.wait_for_function("() => window.__ef && __ef.ready && __ef.ready()")
        c1 = await s.page.evaluate("() => __ef.floorColors()")
        assert await s.page.evaluate("() => document.querySelectorAll('#stage canvas').length") == 1
        assert c1 != c0, (c0, c1)
        ch = await s.page.evaluate("() => __ef.charges()")
        assert len(ch) == 2 and all(c['q'] > 0 for c in ch), ('scene kept across theme switch', ch)
        await s.page.click('#themeBtn')
        await s.page.wait_for_timeout(400)
        c2 = await s.page.evaluate("() => __ef.floorColors()")
        assert await s.page.evaluate("() => document.querySelectorAll('#stage canvas').length") == 1
        assert c2 == c0, (c0, c2)
        await panel_clean(s)
        assert not s.errors, s.errors
    finally:
        await s.close()


async def press_on_charge(s, i):
    p = await s.page.evaluate("(i) => __ef.screenOf(i)", i)
    await s.page.mouse.move(p['x'], p['y'])
    await s.page.mouse.down()
    return p


async def test_leave_mid_drag():
    s = await open_sim()
    try:
        await s.page.evaluate("() => __ef.preset('dipole')")
        p = await press_on_charge(s, 0)
        for k in range(5):
            await s.page.mouse.move(p['x'] + 6 * (k + 1), p['y'] + 3 * (k + 1))
            await s.page.wait_for_timeout(30)
        st = await s.page.evaluate("() => [__ef.dragging(), __ef.controlsEnabled()]")
        assert st == [True, False], st
        await s.page.evaluate("() => { location.hash = '#estat'; }")
        await s.page.wait_for_timeout(500)
        await s.page.mouse.move(p['x'] + 60, p['y'] + 40)
        await s.page.mouse.up()
        await s.page.wait_for_timeout(100)
        assert not s.errors, s.errors
        await s.page.evaluate("() => { location.hash = '#estat-sim'; }")
        await s.page.wait_for_selector('#stage canvas')
        await s.page.wait_for_function("() => window.__ef && __ef.ready && __ef.ready()")
        st = await s.page.evaluate("() => [__ef.dragging(), __ef.controlsEnabled(), __ef.charges().length]")
        assert st == [False, True, 2], st
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_mobile_layout():
    s = await open_sim(viewport=(390, 844))
    try:
        ov = await s.page.evaluate("() => document.documentElement.scrollWidth")
        assert ov <= 390, ov
        boxes = await s.page.evaluate("""() => [...document.querySelectorAll('#panel button, #panel input')]
            .map(b => { const r = b.getBoundingClientRect(); return [r.left, r.right, r.width]; })""")
        assert boxes and all(b[0] >= 0 and b[1] <= 390 and b[2] > 0 for b in boxes), boxes
        btn = s.page.locator('#panel .ef-presets button[data-p="clear"]')
        await btn.scroll_into_view_if_needed()
        await btn.click()
        assert await s.page.evaluate("() => __ef.charges().length") == 0
        btn = s.page.locator('#panel .ef-presets button[data-p="dipole"]')
        await btn.click()
        assert await s.page.evaluate("() => __ef.charges().length") == 2
        ov = await s.page.evaluate("() => document.documentElement.scrollWidth")
        assert ov <= 390, ov
        await panel_clean(s)
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_click_place_and_select():
    s = await open_sim()
    try:
        await s.page.evaluate("() => __ef.preset('dipole')")
        await s.page.click('#panel .ef-mode button[data-v="neg"]')
        p = await s.page.evaluate("() => __ef.screenOfPoint(8, -8)")
        await s.page.mouse.click(p['x'], p['y'])
        ch = await s.page.evaluate("() => __ef.charges()")
        assert len(ch) == 3, ch
        assert ch[2]['q'] < 0 and abs(ch[2]['x'] - 8) <= 0.6 and abs(ch[2]['z'] + 8) <= 0.6, ch
        assert await s.page.evaluate("() => __ef.selected()") == 2
        txt = await panel_clean(s)
        assert 'µC' in txt, txt
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_fps_drag():
    s = await open_sim()
    try:
        await s.page.evaluate("() => __ef.preset('dipole')")
        full = await s.page.evaluate("() => __ef.lines().length")
        f0 = await s.page.evaluate("() => __ef.frames()")
        p = await press_on_charge(s, 0)
        for k in range(20):
            await s.page.mouse.move(p['x'] + 3 * (k + 1), p['y'] - 2 * (k + 1))
            await s.page.wait_for_timeout(50)
        f1 = await s.page.evaluate("() => __ef.frames()")
        during = await s.page.evaluate("() => __ef.lines().length")
        await s.page.mouse.up()
        await s.page.wait_for_timeout(400)
        assert f1 - f0 >= 10, ('frames during 1 s drag', f1 - f0)
        assert during < full, ('reduced line density while dragging', during, full)
        st = await s.page.evaluate("() => [__ef.dragging(), __ef.controlsEnabled(), __ef.charges()[0], __ef.lines().length]")
        assert st[0] is False and st[1] is True, st
        assert abs(st[2]['x'] + 5) > 0.4 or abs(st[2]['z']) > 0.4, ('charge moved', st)
        assert st[3] > during, ('full density after release', st, during)
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_test_charge():
    s = await open_sim()
    try:
        r0 = await s.page.evaluate("() => { __ef.preset('dipole'); __ef.testCharge(-5, 2); return __ef.testState(); }")
        await s.page.wait_for_timeout(1500)
        r1 = await s.page.evaluate("() => __ef.testState()")
        assert r0['active'], r0
        d0 = ((r0['x'] + 5) ** 2 + r0['z'] ** 2) ** 0.5
        d1 = ((r1['x'] + 5) ** 2 + r1['z'] ** 2) ** 0.5
        assert d1 > d0 + 0.5, ('positive test charge is pushed away from +', r0, r1)
        txt = await panel_clean(s)
        assert 'เชิงคุณภาพ' in txt and 'ความเฉื่อย' in txt, txt
        assert '1 หน่วยฉาก = 1 cm' in txt, txt
        assert not s.errors, s.errors
    finally:
        await s.close()



# ───────────── Task 3 review fixes ─────────────

def sheet_index(c):
    """+1 for the + sheet, −1 for the − sheet (plates preset)."""
    return 1 if c['q'] > 0 else -1


async def test_plates_uniform_and_locked():
    s = await open_sim()
    try:
        r = await s.page.evaluate("""() => { __ef.preset('plates');
            return { c: __ef.charges(), l: __ef.lines(), locked: __ef.locked() }; }""")
        c, lines = r['c'], r['l']
        assert r['locked'] is True
        assert len(c) > 8 and len([x for x in c if x['q'] > 0]) == len([x for x in c if x['q'] < 0]), len(c)
        fromP = [L for L in lines if c[L['from']]['q'] > 0]
        ok = [L for L in fromP if L['to'] >= 0 and c[L['to']]['q'] < 0]
        assert fromP and len(ok) >= 0.8 * len(fromP), (len(ok), len(fromP))
        # the sim's own readout: near-uniform E in the central region, along the plate normal
        pts = [(0, 0), (1.5, 1), (-1.5, 1), (1.5, -1), (-1.5, -1)]
        ro = await s.page.evaluate("(pts) => pts.map(p => __ef.readout(p[0], p[1]))", pts)
        nrm = await s.page.evaluate("() => __ef.plateNormal()")
        E0 = ro[0]['E']
        assert E0 and E0 > 0, ro
        import math
        for (x, z), q in zip(pts, ro):
            assert abs(q['E'] / E0 - 1) <= 0.20, ((x, z), q['E'], E0)
            cosang = (q['Ex'] * nrm[0] + q['Ez'] * nrm[1]) / q['E']
            assert math.degrees(math.acos(max(-1, min(1, cosang)))) <= 5, ((x, z), q, nrm)
        # locked demo: no placing, dragging or q editing
        r2 = await s.page.evaluate("""() => { const n = __ef.charges().length, c0 = __ef.charges()[0];
            const placed = __ef.place(15, 15, 1); __ef.drag(0, 10, 10); __ef.setQ(0, 5);
            const c1 = __ef.charges()[0];
            return { n, n2: __ef.charges().length, placed, same: c0.x === c1.x && c0.z === c1.z && c0.q === c1.q,
                     slider: document.querySelector('#panel input[type=range]').disabled }; }""")
        assert r2['placed'] is False and r2['n'] == r2['n2'] and r2['same'] and r2['slider'], r2
        await s.page.wait_for_timeout(10500)
        note = s.page.locator('#panel .ef-lock')
        assert await note.is_visible()
        t = await note.inner_text()
        assert 'ล้างฉาก' in t and 'สาธิต' in t, t
        await s.page.click('#panel .ef-presets button[data-p="clear"]')
        assert not await note.is_visible()
        assert await s.page.evaluate("() => [__ef.locked(), __ef.place(3, 3, 1), __ef.charges().length]") == [False, True, 1]
        await panel_clean(s)
        assert not s.errors, s.errors
    finally:
        await s.close()


def crossings(a, b, thr=12):
    """count runs where the with-contours pixel is darker/different than the no-contour pixel"""
    lum = lambda p: 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]
    runs, inrun = 0, False
    for pa, pb in zip(a, b):
        d = abs(lum(pa) - lum(pb)) > thr
        if d and not inrun:
            runs += 1
        inrun = d
    return runs


async def test_contour_step_per_scene():
    s = await open_sim()
    try:
        r = await s.page.evaluate("""() => { __ef.preset('plates');
            const ch = __ef.charges().map(c => ({ x: c.x, y: c.y, z: c.z, q: c.q }));
            const dv = __ef.contourStep();
            const nrm = __ef.plateNormal();
            const a = EField.potential(ch, { x: -1.5 * nrm[0], y: 0, z: -1.5 * nrm[1] }), b = EField.potential(ch, { x: 1.5 * nrm[0], y: 0, z: 1.5 * nrm[1] });
            const lo = Math.min(a, b), hi = Math.max(a, b);
            let n = 0; for (let k = Math.ceil(lo / dv); k * dv < hi; k++) if (k * dv > lo) n++;
            return { dv, n, nrm, note: document.querySelector('#panel .ef-dv').textContent,
                     line: __ef.floorLine(-1.9 * nrm[0], -1.9 * nrm[1], 1.9 * nrm[0], 1.9 * nrm[1], 240) }; }""")
        dv = r['dv']
        assert str(dv)[0] in '125' and set(str(int(dv))[1:]) <= {'0'}, ('1-2-5 ladder', dv)
        assert 4 <= r['n'] <= 10, r['n']
        assert any(ch.isdigit() for ch in r['note']) and 'V' in r['note'], r['note']
        cx = crossings(r['line']['on'], r['line']['off'])
        assert cx >= 4, ('visible contours across the gap', cx)
        d = await s.page.evaluate("""() => { __ef.preset('dipole');
            return { dv: __ef.contourStep(), note: document.querySelector('#panel .ef-dv').textContent,
                     line: __ef.floorLine(-3, 4, 3, 4, 240) }; }""")
        assert 2e4 <= d['dv'] <= 1e5, d['dv']
        assert crossings(d['line']['on'], d['line']['off']) >= 2
        assert d['note'] != r['note'], (d['note'], r['note'])
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_arrowheads_not_facing_camera():
    s = await open_sim()
    try:
        r = await s.page.evaluate("() => { __ef.preset('pp'); return __ef.arrowStats(); }")
        await s.page.wait_for_timeout(300)
        st = await s.page.evaluate("() => __ef.arrowStats()")
        assert st['shown'] > 0 and st['facing'] == 0, st
        await s.page.evaluate("() => __ef.setCamera(0, 40, 0.01)")       # straight down: vertical lines face the camera
        await s.page.wait_for_timeout(400)
        st2 = await s.page.evaluate("() => __ef.arrowStats()")
        assert st2['shown'] > 0 and st2['facing'] == 0, st2
        assert st2['all'] > st2['shown'], st2
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_touch_pick_slop():
    s = await open_sim()
    try:
        r = await s.page.evaluate("""() => { __ef.preset('dipole'); const p = __ef.screenOf(0);
            return { touch: __ef.pickAt(p.x + 18, p.y, 'touch'), mouse: __ef.pickAt(p.x + 18, p.y, 'mouse'),
                     far: __ef.pickAt(p.x + 40, p.y, 'touch'), centre: __ef.pickAt(p.x, p.y, 'mouse') }; }""")
        assert r == {'touch': 0, 'mouse': -1, 'far': -1, 'centre': 0}, r
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_dispose_frees_arrows():
    s = await open_sim()
    try:
        await s.page.evaluate("""() => { window.__arrowDisposed = 0;
            const m = __ef._arrows(); m.addEventListener('dispose', () => { window.__arrowDisposed++; }); }""")
        await s.page.evaluate("() => { location.hash = '#estat'; }")
        await s.page.wait_for_timeout(300)
        assert await s.page.evaluate("() => window.__arrowDisposed") >= 1
        assert not s.errors, s.errors
    finally:
        await s.close()


run_tests(globals())
