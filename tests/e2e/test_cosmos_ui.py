"""Browser tests for CosmosUI (Task 5). Run: python3 tests/e2e/test_cosmos_ui.py [test_name ...]"""
from harness import open_page, run_tests

SETUP = """() => {
  window.__calls = [];
  const rec = name => (...a) => __calls.push([name, ...a]);
  window.__ui = CosmosUI.create({ onScrub: rec('scrub'), onScrubEnd: rec('scrubEnd'), onPlayToggle: rec('play'), onSpeed: rec('speed'),
    onToggleGrid: rec('grid'), onToggleLabels: rec('labels'), onToggleSound: rec('sound'), onPrevEra: rec('prev'), onNextEra: rec('next'), onClose: rec('close') });
  document.body.appendChild(__ui.root);
  window.__state = (o) => Object.assign({ t: 1e-9, u: 0.3, tempK: 3.1e14, tempApprox: false, scale: 1.2e-15, playing: true, speed: 1,
    muted: false, soundSuspended: false, eraIndex: 2 }, o || {});
  __ui.showEra(CosmosPhysics.ERAS[2]); __ui.update(__state());
}"""


async def setup(s):
    await s.page.evaluate(SETUP)


async def test_dom_and_a11y():
    s = await open_page()
    try:
        await setup(s)
        r = await s.page.evaluate("""() => ({
          role: __ui.root.getAttribute('role'), modal: __ui.root.getAttribute('aria-modal'),
          range: !!__ui.root.querySelector('input[type=range]'),
          ticks: __ui.root.querySelectorAll('.cc-tick').length,
          hud: [...__ui.root.querySelectorAll('[data-hud]')].map(e => e.classList.contains('mono')),
          live: !!__ui.root.querySelector('[aria-live]'),
          stage: __ui.root.contains(__ui.stage)
        })""")
        assert r['role'] == 'dialog' and r['modal'] == 'true', r
        assert r['range'] and r['ticks'] == 8 and r['live'] and r['stage'], r
        assert len(r['hud']) >= 4 and all(r['hud']), r
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_handlers_fire():
    s = await open_page()
    try:
        await setup(s)
        calls = await s.page.evaluate("""() => {
          const r = __ui.root.querySelector('input[type=range]'); r.value = '0.5'; r.dispatchEvent(new Event('input', { bubbles: true }));
          r.dispatchEvent(new Event('change', { bubbles: true }));
          __ui.root.querySelector('[data-speed="5"]').click();
          __ui.root.querySelector('[data-act=grid]').click();
          __ui.root.querySelector('[data-act=close]').click();
          document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
          return __calls; }""")
        names = [c[0] for c in calls]
        assert ['scrub', 0.5] in calls, calls
        assert 'scrubEnd' in names and ['speed', 5] in calls and ['grid', True] in calls and 'close' in names, calls
        assert 'play' not in names, calls
    finally:
        await s.close()


async def test_update_writes_only_on_change():
    s = await open_page()
    try:
        await setup(s)
        n = await s.page.evaluate("""() => new Promise(res => {
          let n = 0; const mo = new MutationObserver(m => { n += m.length; });
          mo.observe(__ui.root, { subtree: true, childList: true, characterData: true, attributes: true });
          __ui.update(__state()); __ui.update(__state());
          setTimeout(() => { mo.disconnect(); res(n); }, 50); })""")
        assert n == 0, n
        changed = await s.page.evaluate("""() => new Promise(res => {
          let n = 0; const mo = new MutationObserver(m => { n += m.length; });
          mo.observe(__ui.root, { subtree: true, childList: true, characterData: true, attributes: true });
          __ui.update(__state({ t: 2e-9 }));
          setTimeout(() => { mo.disconnect(); res(n); }, 50); })""")
        assert changed > 0
    finally:
        await s.close()


async def test_approx_prefix():
    s = await open_page()
    try:
        await setup(s)
        txt = await s.page.evaluate("() => { __ui.update(__state({ tempApprox: true, tempK: 1.5e26 })); return __ui.root.querySelector('[data-hud=temp]').textContent; }")
        assert txt.startswith('≈'), txt
        txt2 = await s.page.evaluate("() => { __ui.update(__state({ tempApprox: false })); return __ui.root.querySelector('[data-hud=temp]').textContent; }")
        assert not txt2.startswith('≈'), txt2
    finally:
        await s.close()


async def test_mobile_dock():
    s = await open_page(viewport=(390, 844))
    try:
        await setup(s)
        r = await s.page.evaluate("""() => {
          const dock = __ui.root.querySelector('.cc-dock'), rows = new Set();
          for (const el of dock.querySelectorAll(':scope > *')) rows.add(Math.round(el.getBoundingClientRect().top));
          return { rows: rows.size, sw: dock.scrollWidth, cw: dock.clientWidth, rootSw: __ui.root.scrollWidth, vw: innerWidth };
        }""")
        assert r['rows'] >= 2, r
        assert r['sw'] <= r['cw'] and r['rootSw'] <= r['vw'], r
    finally:
        await s.close()


if __name__ == '__main__':
    run_tests(globals())
