"""Browser tests for PracticeUI (Task 3). Run: python3 tests/e2e/test_practice_ui.py [test_name ...]"""
import os
from harness import open_page, run_tests

REC = "() => JSON.parse(localStorage.getItem('einstein_practice_mech') || 'null')"


async def start_level(s, level):
    await s.page.click(f'.px-row[data-level="{level}"] .px-go')
    await s.page.wait_for_selector('.px-item')


async def answer(s, text):
    await s.page.fill('.px-in', text)
    await s.page.click('.px-check')


async def fb_text(s):
    return await s.page.inner_text('.px-fb')


async def correct_value(s):
    return await s.page.evaluate("() => String(__px.current().answer)")


async def mcq_pick(s, right):
    """Pick the right (or a wrong) option of the current MCQ and check it; returns the picked original index."""
    oi = await s.page.evaluate("""(right) => { const it = __px.current();
        return right ? it.a : it.options.findIndex((o, k) => k !== it.a); }""", right)
    await s.page.click(f'.opt[data-oi="{oi}"]')
    await s.page.click('.px-check')
    return oi


async def test_level_map():
    s = await open_page('mech-quiz')
    try:
        r = await s.page.evaluate("""() => ({
          tab: document.querySelector('.tabs a.on').textContent,
          rows: [...document.querySelectorAll('.px-row')].map(r => ({
            name: r.querySelector('.px-lname').textContent.trim(),
            dots: r.querySelectorAll('.px-dot').length,
            colored: r.querySelectorAll('.px-dot.ok, .px-dot.okh, .px-dot.no').length,
            rec: !!r.querySelector('.px-rec') && r.querySelector('.px-rec').textContent.trim() })) })""")
        assert r['tab'] == 'แบบฝึกหัด', r
        names = [x['name'] for x in r['rows']]
        assert names == ['ระดับ 1 · เข้าใจแนวคิด', 'ระดับ 2 · คำนวณ', 'ระดับ 3 · โจทย์ประยุกต์'], names
        assert [x['dots'] for x in r['rows']] == [7, 7, 6], r
        assert all(x['colored'] == 0 for x in r['rows']), r
        assert [x['rec'] for x in r['rows']] == ['แนะนำ', False, False], r
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_mcq_why():
    s = await open_page('mech-quiz')
    try:
        await start_level(s, 1)
        oi = await mcq_pick(s, False)
        await s.page.wait_for_timeout(300)
        it = await s.page.evaluate("() => { const it = __px.current(); return { id: it.id, why: it.options.map(o => o.why), e: it.e }; }")
        html = await s.page.inner_html('.px-fb')
        txt = await fb_text(s)
        assert 'ยังไม่ถูก' in txt, txt
        # plain-text prefix of the why/e strings (MathJax rewrites \( \) parts)
        why = it['why'][oi].split('\\(')[0][:25]
        e = it['e'].split('\\(')[0][:20]
        assert why and why in txt, (why, txt)
        assert e and e in txt, (e, txt)
        assert 'px-why' in html, html
        rec = await s.page.evaluate(REC)
        assert rec['items'][it['id']]['s'] == 'wrong', rec
        assert await s.page.locator('.opt.right').count() == 1
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_numeric_flow():
    s = await open_page('mech-quiz')
    try:
        await start_level(s, 2)
        it = await s.page.evaluate("() => { const it = __px.current(); return { id: it.id, m: it.mistakes[0] }; }")
        assert it['id'] == 'mech-2-01', it
        await answer(s, repr(it['m']['value']))
        txt = await fb_text(s)
        assert it['m']['msg'][:25] in txt, (it, txt)
        assert await s.page.evaluate(REC) is None
        await answer(s, 'abc')
        assert 'อ่านตัวเลขไม่ออก' in await fb_text(s)
        await answer(s, await correct_value(s))
        assert 'ถูกต้อง' in await fb_text(s)
        rec = await s.page.evaluate(REC)
        assert rec['items']['mech-2-01']['s'] == 'ok', rec      # 2 parsed tries; 'abc' not counted
        assert await s.page.is_disabled('.px-in')
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_hints_and_solution():
    s = await open_page('mech-quiz')
    try:
        await start_level(s, 3)
        n = await s.page.evaluate("() => __px.current().hints.length")
        assert n >= 2
        hb = s.page.locator('.px-hintbtn')
        assert (await hb.inner_text()).strip() == f'คำใบ้ 1/{n}'
        await hb.click()
        assert await s.page.locator('.px-hint').count() == 1
        assert (await hb.inner_text()).strip() == f'คำใบ้ 2/{n}'
        await hb.click()
        assert await s.page.locator('.px-hint').count() == 2
        await s.page.click('.px-solbtn')
        await s.page.wait_for_selector('.px-solution', state='visible')
        assert await s.page.is_disabled('.px-in') and await s.page.is_disabled('.px-check')
        rec = await s.page.evaluate(REC)
        assert rec['items']['mech-3-01']['s'] == 'wrong', rec
        await s.page.click('.px-next')
        assert await s.page.evaluate("() => __px.current().id") == 'mech-3-02'
        assert not await s.page.is_disabled('.px-in')
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_new_numbers():
    s = await open_page('mech-quiz')
    try:
        await start_level(s, 2)
        await answer(s, await correct_value(s))
        q1 = await s.page.inner_text('.px-q')
        await s.page.click('.px-newbtn')
        q2 = await s.page.inner_text('.px-q')
        assert q1 != q2, (q1, q2)
        assert not await s.page.is_disabled('.px-in')
        await answer(s, await correct_value(s))
        assert 'ถูกต้อง' in await fb_text(s)
        rec = await s.page.evaluate(REC)
        assert rec['items']['mech-2-01']['s'] == 'ok' and rec['items']['mech-2-01']['n'] == 2, rec
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_rapid_new_numbers():
    s = await open_page('mech-quiz')
    try:
        await s.page.wait_for_function("() => window.MathJax && MathJax.typesetPromise")
        await start_level(s, 2)
        # 5 new number sets inside 300 ms; the solution is opened before each click so the button is offered
        await s.page.evaluate("""() => new Promise(res => {
          let k = 0;
          const step = () => {
            const sol = document.querySelector('.px-solbtn'); if (sol && !sol.disabled) sol.click();
            document.querySelector('.px-newbtn').click();
            if (++k < 5) setTimeout(step, 55); else res();
          };
          step(); })""")
        await s.page.wait_for_timeout(1500)
        await s.page.click('.px-solbtn')
        await s.page.wait_for_timeout(1200)
        r = await s.page.evaluate("""() => ({ vars: __px.current().vars,
            q: document.querySelector('.px-q').textContent,
            sol: document.querySelector('.px-solution').textContent,
            n: document.querySelectorAll('.px-item').length })""")
        assert r['n'] == 1, r
        for v in r['vars'].values():
            assert str(v) in r['q'], (v, r)
            assert str(v) in r['sol'], (v, r)
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_progress_persists():
    s = await open_page('mech-quiz')
    try:
        await start_level(s, 1)
        await mcq_pick(s, False)                    # mech-1-01 wrong
        await s.page.click('.px-next')
        await mcq_pick(s, True)                     # mech-1-02 ok
        await s.page.click('.px-back')
        before = await s.page.evaluate("""() => [...document.querySelectorAll('.px-dot')].map(d => d.className).join('|')
             + '#' + [...document.querySelectorAll('.px-count')].map(d => d.textContent).join('|')""")
        await s.page.reload()
        await s.page.wait_for_selector('.px-map')
        after = await s.page.evaluate("""() => [...document.querySelectorAll('.px-dot')].map(d => d.className).join('|')
             + '#' + [...document.querySelectorAll('.px-count')].map(d => d.textContent).join('|')""")
        assert before == after, (before, after)
        assert 'no' in after and 'ok' in after, after
        redo = s.page.locator('.px-redo')
        assert (await redo.inner_text()).strip() == 'ทำข้อที่ยังผิด (1)'
        await redo.click()
        assert await s.page.evaluate("() => __px.session()") == ['mech-1-01']
        await s.page.click('.px-back')
        s.page.once('dialog', lambda d: d.accept())
        await s.page.click('.px-reset')
        await s.page.wait_for_timeout(200)
        r = await s.page.evaluate("""() => ({ colored: document.querySelectorAll('.px-dot.ok, .px-dot.okh, .px-dot.no').length,
            redo: !!document.querySelector('.px-redo'), rec: localStorage.getItem('einstein_practice_mech') })""")
        assert r['colored'] == 0 and not r['redo'], r
        assert r['rec'] is None or '"items":{}' in r['rec'], r
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_corrupt_progress():
    for raw in ['{"bad":1}', 'not json', '{"v":1,"items":{"mech-1-01":{"s":"bogus"},"gone-9-99":{"s":"ok"}}}']:
        script = "localStorage.setItem('einstein_practice_mech', %r)" % raw
        s = await open_page('mech-quiz', init_script=script)
        try:
            r = await s.page.evaluate("""() => ({ dots: document.querySelectorAll('.px-dot').length,
                colored: document.querySelectorAll('.px-dot.ok, .px-dot.okh, .px-dot.no').length })""")
            assert r == {'dots': 20, 'colored': 0}, (raw, r)
            assert not s.errors, (raw, s.errors)
        finally:
            await s.close()


NEG_ITEMS = """() => {
  const neg = { id: 'mech-x-neg', level: 2, type: 'num', q: 'ทดสอบค่าลบ', answer: -3.2, unit: 'm/s', hints: [], solution: '' };
  const sci = { id: 'mech-x-sci', level: 2, type: 'num', q: 'ทดสอบค่าเล็ก', answer: 2.1e-5, unit: 'm', hints: [], solution: '' };
  PRACTICE.mech.splice(7, 0, neg, sci);
  route();
}"""


async def test_input_mode():
    s = await open_page('mech-quiz')
    try:
        await start_level(s, 2)
        assert await s.page.get_attribute('.px-in', 'inputmode') == 'decimal'
        assert 'พิมพ์แบบ 2.1e-2 ได้' not in await s.page.inner_text('.px-item')
        await s.page.evaluate(NEG_ITEMS)
        await s.page.wait_for_selector('.px-map')
        await start_level(s, 2)
        for want in ['mech-x-neg', 'mech-x-sci']:
            assert await s.page.evaluate("() => __px.current().id") == want
            assert await s.page.get_attribute('.px-in', 'inputmode') == 'text', want
            assert 'พิมพ์แบบ 2.1e-2 ได้' in await s.page.inner_text('.px-item'), want
            await s.page.click('.px-solbtn')
            await s.page.click('.px-next')
        assert await s.page.evaluate("() => __px.current().id") == 'mech-2-01'
        assert await s.page.get_attribute('.px-in', 'inputmode') == 'decimal'
        assert not s.errors, s.errors
    finally:
        await s.close()


NO_HSCROLL = "() => document.documentElement.scrollWidth <= window.innerWidth"


async def test_old_route_and_mobile():
    s = await open_page('mech-quiz', viewport=(390, 844))
    try:
        assert await s.page.locator('.px-map').count() == 1
        assert await s.page.evaluate(NO_HSCROLL)
        await start_level(s, 2)
        await answer(s, '1')
        await s.page.click('.px-hintbtn')
        await s.page.wait_for_timeout(400)
        assert await s.page.evaluate(NO_HSCROLL)
        await s.page.evaluate("() => Theme.set('dark')")
        await s.page.wait_for_timeout(200)
        assert await s.page.evaluate("() => document.documentElement.classList.contains('dark')")
        assert await s.page.locator('.px-item').count() == 1      # theme switch keeps the open item
        await s.page.click('.px-back')
        assert await s.page.locator('.px-map').count() == 1
        assert await s.page.evaluate(NO_HSCROLL)
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_lecture_card_and_home_badge():
    script = """localStorage.setItem('einstein_practice_mech', JSON.stringify({ v: 1, items: {
        'mech-1-01': { s: 'ok', n: 1, t: 1 }, 'mech-1-02': { s: 'ok-help', n: 2, t: 1 }, 'mech-1-03': { s: 'wrong', n: 1, t: 1 } } }))"""
    s = await open_page('mech', init_script=script)
    try:
        card = await s.page.inner_text('.nextcards a[href="#mech-quiz"]')
        assert 'แบบฝึกหัด 20 ข้อ · ทำถูกแล้ว 2' in card, card
        await s.page.evaluate("() => { location.hash = '#home'; }")
        await s.page.wait_for_timeout(300)
        badge = await s.page.inner_text('a.pick[href="#mech"] .badge')
        assert badge.strip() == await s.page.evaluate("() => PracticeUI.progressText('mech')"), badge
        assert '2/20' in badge, badge
        assert not s.errors, s.errors
    finally:
        await s.close()


WX_STATE = """() => { const w = document.querySelector('#lec .wx'); const li = [...w.querySelectorAll('.wx-steps > li')];
  const b = w.querySelector('.wx-next'), c = w.querySelector('.wx-count');
  return { n: li.length, shown: li.filter(x => x.offsetParent !== null).length,
    firstHidden: li.findIndex(x => x.offsetParent === null),
    btn: b ? b.textContent.trim() : null, count: c ? c.textContent.trim() : null,
    countMono: !!c && c.classList.contains('mono'),
    intro: (w.querySelector('.wx-intro') || {}).textContent || null,
    nBtn: w.querySelectorAll('.wx-next').length, nCount: w.querySelectorAll('.wx-count').length,
    nIntro: w.querySelectorAll('.wx-intro').length }; }"""


async def test_worked_stepper():
    s = await open_page('mech')
    try:
        await s.page.wait_for_selector('#lec .wx .wx-next')
        r = await s.page.evaluate(WX_STATE)
        n = r['n']
        assert n >= 2, r
        assert r['shown'] == 0, r
        assert r['intro'].strip() == 'ลองคิดเองก่อน แล้วค่อยเปิดทีละขั้น', r
        assert r['btn'] == 'ดูขั้นต่อไป' and r['count'] == f'ขั้น 0/{n}' and r['countMono'], r
        nwx = await s.page.evaluate("() => document.querySelectorAll('#lec .wx').length")
        assert nwx >= 6, nwx
        # every example on the page starts closed
        assert await s.page.evaluate("() => [...document.querySelectorAll('#lec .wx-steps > li')].every(x => x.offsetParent === null)")
        btn = s.page.locator('#lec .wx >> nth=0').locator('.wx-next')
        for k in range(1, n + 1):
            await btn.click()
            r = await s.page.evaluate(WX_STATE)
            assert r['shown'] == k, (k, r)
            assert r['firstHidden'] == (k if k < n else -1), (k, r)
            assert r['count'] == f'ขั้น {k}/{n}', (k, r)
            if k == 2:
                assert r['count'] == f'ขั้น 2/{n}', r
            if k < n:
                assert r['btn'] == 'ดูขั้นต่อไป', (k, r)
        assert r['btn'] is None and r['nBtn'] == 0, r
        # other examples are untouched
        assert await s.page.evaluate("() => [...document.querySelectorAll('#lec .wx')].slice(1).every(w => w.querySelectorAll('.wx-steps > li:not([hidden])').length === 0)")
        # enhancing again does not duplicate controls
        await s.page.evaluate("() => PracticeUI.enhanceWorked(document.getElementById('lec'))")
        r = await s.page.evaluate(WX_STATE)
        assert r['nBtn'] == 0 and r['nCount'] == 1 and r['nIntro'] == 1 and r['shown'] == n, r
        dup = await s.page.evaluate("() => [...document.querySelectorAll('#lec .wx')].slice(1).map(w => [w.querySelectorAll('.wx-next').length, w.querySelectorAll('.wx-count').length, w.querySelectorAll('.wx-intro').length].join())")
        assert all(d == '1,1,1' for d in dup), dup
        # MathJax rendered inside the revealed steps
        await s.page.wait_for_function("() => document.querySelector('#lec .wx .wx-steps mjx-container')", timeout=8000)
        size = await s.page.evaluate("""() => { const svgs = [...document.querySelectorAll('#lec .wx')[0].querySelectorAll('.wx-steps mjx-container svg')];
            return svgs.length && svgs.every(x => x.getBoundingClientRect().width > 2 && x.getBoundingClientRect().height > 2); }""")
        assert size, 'math in revealed steps has no size'
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_worked_mobile_dark_reduced_motion():
    s = await open_page('mech', viewport=(390, 844), reduced_motion=True)
    try:
        await s.page.evaluate("() => Theme.set('dark')")
        await s.page.wait_for_selector('#lec .wx .wx-next')
        for _ in range(12):
            b = s.page.locator('#lec .wx >> nth=-1').locator('.wx-next')
            if not await b.count():
                break
            await b.click()
        assert await s.page.locator('#lec .wx >> nth=-1').locator('.wx-next').count() == 0
        r = await s.page.evaluate("""() => { const li = document.querySelectorAll('#lec .wx')[document.querySelectorAll('#lec .wx').length - 1].querySelector('.wx-steps > li');
            return { anim: getComputedStyle(li).animationName, noScroll: document.documentElement.scrollWidth <= window.innerWidth }; }""")
        assert r['anim'] == 'none', r
        assert r['noScroll'], r
        assert not s.errors, s.errors
    finally:
        await s.close()


def practice_chapters():
    d = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'js', 'data', 'practice')
    return sorted(f[:-3] for f in os.listdir(d) if f.endswith('.js'))


async def test_worked_all_open_fit_390():
    """Every worked example of every chapter with practice data, fully opened, fits a 390 px phone (no sideways scroll)."""
    for ch in practice_chapters():
        s = await open_page(ch, viewport=(390, 844))
        try:
            await s.page.wait_for_selector('#lec .wx .wx-next')
            n = await s.page.locator('#lec .wx').count()
            for i in range(n):
                wx = s.page.locator('#lec .wx').nth(i)
                for _ in range(12):
                    if not await wx.locator('.wx-next').count():
                        break
                    await wx.locator('.wx-next').click()
                assert await wx.locator('.wx-next').count() == 0, (ch, i)
            await s.page.evaluate("() => (window.MathJax && MathJax.startup && MathJax.startup.promise) || null")
            await s.page.wait_for_timeout(500)
            r = await s.page.evaluate("""() => {
                const wide = [...document.querySelectorAll('#lec .wx mjx-container')]
                    .filter(m => m.getBoundingClientRect().right > window.innerWidth + 0.5)
                    .map(m => m.textContent.slice(0, 50));
                return { sw: document.documentElement.scrollWidth, vw: window.innerWidth,
                         hidden: document.querySelectorAll('#lec .wx-steps > li[hidden]').length, wide }; }""")
            assert r['hidden'] == 0, (ch, r)
            assert r['sw'] <= 390 and not r['wide'], (ch, r)
            assert not s.errors, (ch, s.errors)
        finally:
            await s.close()


run_tests(globals())
