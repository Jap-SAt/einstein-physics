"""Browser tests for the electrostatics chapter registration (Task 2). Run: python3 tests/e2e/test_estat.py"""
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


run_tests(globals())
