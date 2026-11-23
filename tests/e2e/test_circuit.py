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


run_tests(globals())
