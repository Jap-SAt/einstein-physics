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
        assert hrefs == ['#mech', '#thermo', '#waves', '#estat', '#circuit', '#particle', '#em', '#atom', '#nuclear'], hrefs
        mods = await s.page.evaluate("() => MODS.map(m => [m.id, m.no, m.title])")
        assert [m[1] for m in mods] == ['0%d' % i for i in range(1, 10)], mods
        by = {m[0]: m for m in mods}
        assert by['estat'][1] == '04' and by['estat'][2] == 'ไฟฟ้าสถิต', by['estat']
        assert by['particle'][1] == '06', by['particle']
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
        await s.page.wait_for_selector('.px-row')
        r = await s.page.evaluate("""() => ({
            dots: [...document.querySelectorAll('.px-row')].map(r => r.querySelectorAll('.px-dot').length),
            old: !!document.querySelector('#qb, #opts'),
            text: document.getElementById('tabview').innerText })""")
        assert r['dots'] == [7, 7, 6], r
        assert not r['old'], r
        assert 'กำลังจัดทำ' not in r['text'], r['text'][:200]
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_estat_quiz_guard_without_data():
    """If PRACTICE.estat is missing or empty, #estat-quiz still shows the "กำลังจัดทำ" message (no level map, no error)."""
    # the data script runs before app.js renders, so drop PRACTICE.estat as soon as it is defined
    drop = """Object.defineProperty(window, 'PRACTICE', { configurable: true, set(v) {
        Object.defineProperty(window, 'PRACTICE', { value: v, writable: true, configurable: true });
        Object.defineProperty(v, 'estat', { get() { return undefined; }, set(_) {}, configurable: true }); } });"""
    for init in (drop, drop.replace('return undefined;', 'return [];')):
        s = await open_page('estat-quiz', init_script=init)
        try:
            await s.page.wait_for_timeout(400)
            assert await s.page.evaluate("() => !(PRACTICE.estat || []).length && PRACTICE.mech.length === 20")
            assert 'แบบฝึกหัดบทนี้กำลังจัดทำ' in await s.page.inner_text('#tabview')
            assert await s.page.locator('.px-row').count() == 0
            await s.page.evaluate("() => { location.hash = '#estat'; }")
            await s.page.wait_for_timeout(300)
            assert 'กำลังจัดทำ' in await s.page.inner_text('.nextcards a[href="#estat-quiz"]')
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
        # same line in the full scene (lines, arrows, charges drawn): contours must not be buried
        full = await s.page.evaluate("(n) => __ef.floorLine(0.75 * n[0] - 1.9 * n[0], -1.9 * n[1], 0.75 + 1.9 * n[0], 1.9 * n[1], 240, true)", r['nrm'])
        fx = crossings(full['on'], full['off'])
        assert fx >= 4, ('contours visible in the full scene', fx)
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



# ───────────── Task 3 review fixes, round 2 ─────────────

async def test_contour_step_stable_under_edits():
    s = await open_sim()
    try:
        r = await s.page.evaluate("""() => { __ef.preset('dipole');
            const dv0 = __ef.contourStep(), line0 = __ef.floorLine(-3, 4, 3, 4, 300);
            __ef.setQ(0, 3);
            const dv1 = __ef.contourStep(), line1 = __ef.floorLine(-3, 4, 3, 4, 300), fl1 = __ef.dvFlashed();
            __ef.setQ(0, 5);
            const dv2 = __ef.contourStep(), fl2 = __ef.dvFlashed();
            return { dv0, dv1, dv2, fl1, fl2, line0, line1 }; }""")
        assert r['dv1'] == r['dv0'], ('ΔV kept when q goes 2 → 3 µC', r['dv0'], r['dv1'])
        assert not r['fl1']
        c0, c1 = crossings(r['line0']['on'], r['line0']['off']), crossings(r['line1']['on'], r['line1']['off'])
        assert c1 > c0, ('stronger charge → more (closer) contours', c0, c1)
        assert r['dv2'] == r['dv0'] or r['fl2'], ('ΔV kept at 5 µC, or stepped with the note highlighted', r)
        r2 = await s.page.evaluate("""() => { __ef.preset('plates'); const a = __ef.contourStep();
            __ef.preset('clear'); __ef.place(2, 2, 1);
            return { a, b: __ef.contourStep(), ideal: __ef.idealStep(), note: document.querySelector('#panel .ef-dv').textContent }; }""")
        assert r2['a'] != r2['b'] and r2['b'] == r2['ideal'], ('fresh ΔV after clear + first placement', r2)
        assert r2['note'].replace(' ', '').startswith(str(int(r2['b'] / 1000))), r2
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_projection_fresh_after_preset():
    s = await open_sim()
    try:
        r = await s.page.evaluate("""() => { __ef.preset('plates');
            const a = __ef.screenOfPoint(0, 0); const i = __ef.charges().length - 1; const b = __ef.screenOf(i);
            return { a, b, ref: __ef.screenOfPointFresh(0, 0) }; }""")
        assert abs(r['a']['x'] - r['ref']['x']) < 0.5 and abs(r['a']['y'] - r['ref']['y']) < 0.5, r
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_lecture_content():
    """Task 4: the full lecture — five sections, each with a worked example (>= 2 steps), misconception boxes,
    end card, sim link, s4 energy gain qV + eV, s5 C = eps0 A/d, no Thai inside \\text{}, MathJax clean,
    and every worked example fully opened fits a 390 px phone."""
    s = await open_page('estat', viewport=(390, 844))
    try:
        await s.page.wait_for_selector('#lec .wx .wx-next')
        raw = await s.page.evaluate("() => document.getElementById('lec-estat').innerHTML")
        assert 'กำลังจัดทำ' not in raw, 'placeholder text left'
        assert 'qV' in raw and '\\varepsilon_0' in raw, 'qV / varepsilon_0 missing'
        assert 'อิเล็กตรอนโวลต์' in raw and '\\text{eV}' in raw, 'eV not defined'
        import re
        bad = re.findall(r'\\text\{[^}]*[\u0E00-\u0E7F][^}]*\}', raw)
        assert not bad, bad
        assert 'details class="ex"' not in raw and '<details' not in raw, 'details.ex left'
        r = await s.page.evaluate("""() => {
            const lec = document.querySelector('#lec'); const out = []; let cur = null;
            for (const el of lec.querySelectorAll('h2, .wx, .check')) {
                if (el.tagName === 'H2') { cur = { id: el.id, wx: [], check: 0 }; out.push(cur); }
                else if (cur && el.classList.contains('wx')) cur.wx.push(el.querySelectorAll('.wx-steps > li').length);
                else if (cur) cur.check++;
            }
            return { secs: out, sum: !!lec.querySelector('.sumbox'), sim: !!lec.querySelector('a.try[href="#estat-sim"]') }; }""")
        assert [x['id'] for x in r['secs']] == ['s1', 's2', 's3', 's4', 's5'], r
        for sec in r['secs']:
            assert sec['wx'] and all(n >= 2 for n in sec['wx']), sec
            assert sec['check'] >= 1, sec
        assert r['sum'] and r['sim'], r
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
            sw: document.documentElement.scrollWidth, vw: window.innerWidth,
            merr: document.querySelectorAll('#lec mjx-merror, #lec [data-mjx-error]').length,
            raw: (document.querySelector('#lec').innerText.match(/\\\\[(\\[]/g) || []).length,
            hidden: document.querySelectorAll('#lec .wx-steps > li[hidden]').length,
            wide: [...document.querySelectorAll('#lec mjx-container')]
                .filter(x => x.getBoundingClientRect().right > window.innerWidth + 0.5).map(x => x.textContent.slice(0, 40)) })""")
        assert m['hidden'] == 0 and m['merr'] == 0 and m['raw'] == 0, m
        assert m['sw'] <= 390 and not m['wide'], m
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_lecture_chapter_numbers_match_mods():
    """Every "บทที่ NN" in any lecture template names its chapter right after the number, and NN is that chapter's MODS.no."""
    s = await open_page('home')
    try:
        r = await s.page.evaluate("""() => {
            const out = [];
            for (const t of document.querySelectorAll('template[id^="lec-"]')) {
                const txt = t.content.textContent.replace(/\\s+/g, ' ');
                for (const m of txt.matchAll(/บทที่ (\\d+)/g)) {
                    const after = txt.slice(m.index + m[0].length, m.index + m[0].length + 40).trim();
                    const mod = MODS.find(x => after.startsWith(x.title) || after.startsWith(x.short));
                    out.push({ lec: t.id, no: m[1], after: after.slice(0, 25), modNo: mod ? mod.no : null });
                }
            }
            return out; }""")
        assert r, 'expected at least one chapter-number mention'
        bad = [x for x in r if x['modNo'] != x['no']]
        assert not bad, bad
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_no_horizontal_overflow_390():
    for h in ['home', 'mech', 'thermo', 'waves', 'estat', 'particle', 'em', 'atom', 'nuclear']:
        s = await open_page(h, viewport=(390, 844))
        try:
            w = await s.page.evaluate("() => document.documentElement.scrollWidth")
            assert w <= 390, (h, w)
            assert not s.errors, s.errors
        finally:
            await s.close()


async def test_zoomtag_clear_of_reset_390():
    s = await open_page('estat-sim', viewport=(390, 844))
    try:
        await s.page.wait_for_selector('#tReset')
        r = await s.page.evaluate("""() => {
            const b = document.querySelector('#tReset').getBoundingClientRect();
            const z = document.querySelector('.zoomtag').getBoundingClientRect();
            const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
            return { inter: !(b.right <= z.left || z.right <= b.left || b.bottom <= z.top || z.bottom <= b.top),
                     hit: !!hit && !!hit.closest('#tReset'), b: [b.left, b.top, b.right, b.bottom], z: [z.left, z.top, z.right, z.bottom] };
        }""")
        assert not r['inter'], r
        assert r['hit'], r
        assert not s.errors, s.errors
    finally:
        await s.close()


async def section_top(s, sec):
    return await s.page.evaluate("""(id) => { const h = document.querySelector('#lec #' + id);
        return h ? [h.getBoundingClientRect().top, innerHeight] : null; }""", sec)


async def check_link(s, link_sel, idx, sec, expect_hash):
    await s.page.wait_for_selector(link_sel, state='attached')
    loc = s.page.locator(link_sel).nth(idx)
    await loc.scroll_into_view_if_needed()
    await loc.click()
    await s.page.wait_for_timeout(1200)
    h = await s.page.evaluate("() => location.hash")
    assert h == expect_hash, h
    tab = await s.page.evaluate("() => document.querySelector('.tabs a.on').getAttribute('href')")
    assert tab == '#estat', tab
    st = await section_top(s, sec)
    assert st and 64 <= st[0] < st[1], (sec, st)


async def test_cross_links():
    # from particle (two links) and atom, section is scrolled into view below the sticky header
    for h, sel, idx, sec in [('particle', '.lec a[href="#estat?s=s3"]', 0, 's3'),
                             ('particle', '.lec a[href="#estat?s=s3"]', 1, 's3'),
                             ('atom', '.lec a[href="#estat?s=s4"]', 0, 's4')]:
        s = await open_page(h)
        try:
            await check_link(s, sel, idx, sec, '#estat?s=' + sec)
            assert not s.errors, s.errors
        finally:
            await s.close()
    # target already open: scroll away, then click a link-equivalent hash on the same chapter
    s = await open_page('estat')
    try:
        await s.page.wait_for_selector('#lec h2')
        await s.page.evaluate("() => { location.hash = '#estat?s=s4'; }")
        await s.page.wait_for_timeout(1000)
        st = await section_top(s, 's4')
        assert st and 64 <= st[0] < st[1], st
        await s.page.evaluate("() => window.scrollTo(0, 0)")
        await s.page.evaluate("() => { const a = document.createElement('a'); a.href = '#estat?s=s4'; a.id = 'tl'; a.textContent = 'x'; document.querySelector('#lec').prepend(a); }")
        await s.page.click('#tl')
        await s.page.wait_for_timeout(1000)
        st = await section_top(s, 's4')
        assert st and 64 <= st[0] < st[1], st
        # plain #estat still opens the top of the chapter
        await s.page.evaluate("() => { location.hash = '#estat'; }")
        await s.page.wait_for_timeout(600)
        y = await s.page.evaluate("() => scrollY")
        assert y == 0, y
        assert not s.errors, s.errors
    finally:
        await s.close()


async def follow_particle_link(s):
    sel = '.lec a[href="#estat?s=s3"]'
    await s.page.wait_for_selector(sel, state='attached')
    loc = s.page.locator(sel).first
    await loc.scroll_into_view_if_needed()
    await loc.click()


async def test_link_then_leave_quickly():
    s = await open_page('particle')
    try:
        await follow_particle_link(s)
        await s.page.wait_for_timeout(100)
        await s.page.evaluate("() => { location.hash = '#particle'; }")
        await s.page.wait_for_timeout(1000)
        y = await s.page.evaluate("() => scrollY")
        assert y <= 5, y
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_link_then_user_scroll_not_snapped_back():
    s = await open_page('particle')
    try:
        await follow_particle_link(s)
        await s.page.wait_for_timeout(100)
        await s.page.mouse.move(600, 400)
        await s.page.mouse.wheel(0, 700)
        await s.page.wait_for_timeout(250)
        y1 = await s.page.evaluate("() => scrollY")
        await s.page.wait_for_timeout(1000)
        y2 = await s.page.evaluate("() => scrollY")
        assert abs(y2 - y1) <= 5, (y1, y2)
        st = await section_top(s, 's3')
        assert abs(st[0]) > 100, st
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_link_then_back():
    s = await open_page('particle')
    try:
        await follow_particle_link(s)
        await s.page.wait_for_timeout(1000)
        await s.page.go_back()
        await s.page.wait_for_timeout(1000)
        h = await s.page.evaluate("() => location.hash")
        tab = await s.page.evaluate("() => document.querySelector('.tabs a.on').getAttribute('href')")
        assert h == '#particle' and tab == '#particle', (h, tab)
        assert not s.errors, s.errors
    finally:
        await s.close()


# ───────────── final review fixes ─────────────

async def test_zero_charge_keeps_step_and_probe_defined():
    s = await open_sim()
    try:
        r = await s.page.evaluate("""() => { __ef.preset('clear'); __ef.place(2, 2, 1);
            const dv0 = __ef.contourStep(), q0 = __ef.charges()[0].q;
            __ef.setQ(0, 0);
            const dv1 = __ef.contourStep(), fl1 = __ef.dvFlashed(), msg0 = document.querySelector('#panel').innerText;
            const ro0 = __ef.readout(2, 2);
            __ef.setQ(0, q0);
            const dv2 = __ef.contourStep(), fl2 = __ef.dvFlashed();
            __ef.setQ(0, 0); __ef.place(-6, -6, -1);
            const ro1 = __ef.readout(2, 2);
            return { dv0, dv1, dv2, fl1, fl2, ro0, ro1, q0 }; }""")
        assert r['dv1'] == r['dv0'] and r['dv2'] == r['dv0'], ('ΔV unchanged through 0 µC and back', r)
        assert not r['fl1'] and not r['fl2'], ('no "changed" flash', r)
        ro = r['ro0']
        assert ro['E'] == 0 and ro['V'] == 0, ('finite E = 0, V = 0 at a 0 µC charge', ro)
        assert r['ro1']['E'] is not None and r['ro1']['V'] is not None and r['ro1']['V'] < 0, r['ro1']
        txt = await s.page.inner_text('#panel')
        assert 'ไม่นิยาม' not in txt, txt
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_zero_contour_not_heavier_and_legend():
    s = await open_sim()
    try:
        r = await s.page.evaluate("""() => { __ef.preset('dipole');
            const c = __ef.charges(), p = c.find(x => x.q > 0), n = c.find(x => x.q < 0);
            const dx = n.x - p.x, dz = n.z - p.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
            const a = 2.2, b = L - 2.2, N = 900;
            const mid = L / 2;
            const line = __ef.floorLine(p.x + ux * a, p.z + uz * a, p.x + ux * b, p.z + uz * b, N);
            return { line, a, b, mid, N }; }""")
        lum = lambda q: 0.3 * q[0] + 0.59 * q[1] + 0.11 * q[2]
        N = r['N']
        ink = [max(0, abs(lum(x) - lum(y))) if x and y else 0 for x, y in zip(r['line']['on'], r['line']['off'])]
        tm = (r['mid'] - r['a']) / (r['b'] - r['a'])
        w = 0.06 * N / 1.0
        zi = [i for i in range(N) if abs(i / (N - 1) - tm) <= 0.04]
        oi = [i for i in range(N) if abs(i / (N - 1) - tm) > 0.08]
        zero_peak, other_peak = max(ink[i] for i in zi), max(ink[i] for i in oi)
        assert other_peak > 12, ('ordinary contours visible on the sampled segment', other_peak)
        assert zero_peak > 3, ('V = 0 contour is still visible', zero_peak)
        # ink on the V = 0 line is clearly lighter than on an ordinary contour (it must not read as an axis)
        assert zero_peak <= 0.8 * other_peak, ('V = 0 contour lighter than ordinary', zero_peak, other_peak)
        txt = await s.page.inner_text('#panel .ef-legend')
        assert 'V = 0' in txt and 'เส้นศักย์เท่า' in txt, txt
        # V = 0 is midway only for equal and opposite charges: the legend must say so, not claim it in general
        assert 'อยู่กึ่งกลางระหว่าง + กับ −' not in txt and 'เท่ากันและตรงข้าม' in txt, txt
        assert not s.errors, s.errors
    finally:
        await s.close()


run_tests(globals())
