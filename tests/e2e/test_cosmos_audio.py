"""Browser tests for CosmosAudio (Task 2). Run: python3 tests/e2e/test_cosmos_audio.py"""
from harness import open_page, run_tests


async def test_ramp_and_compressor():
    s = await open_page()
    try:
        await s.page.evaluate("() => { CosmosAudio.prime(); window.__e = CosmosAudio.create(); __e.start(); }")
        await s.page.wait_for_timeout(100)
        early = await s.page.evaluate("__e.debug.masterGain()")
        assert early < 0.05, early
        await s.page.wait_for_timeout(3400)
        late = await s.page.evaluate("__e.debug.masterGain()")
        assert late >= 0.4, late
        assert await s.page.evaluate("__e.debug.contextState()") == 'running'
        assert not s.errors, s.errors
    finally:
        await s.close()


async def test_impact_rate_limit():
    s = await open_page()
    try:
        res = await s.page.evaluate("""() => { CosmosAudio.prime(); const e = CosmosAudio.create(); e.start(); window.__e = e;
            e.update(1e-9, 'quark', true, 0);
            const r = []; for (let i = 0; i < 10; i++) r.push(e.impact('era')); return r; }""")
        assert res.count(True) == 1, res
        assert await s.page.evaluate("__e.debug.impactsPlayed") == 1
        await s.page.wait_for_timeout(700)
        assert await s.page.evaluate("__e.impact('era')") is True
    finally:
        await s.close()


async def test_mute_persists():
    s = await open_page()
    try:
        await s.page.evaluate("async () => { CosmosAudio.prime(); const e = CosmosAudio.create(); e.start(); e.setMuted(true); await e.dispose(); }")
        assert await s.page.evaluate("localStorage.getItem('einstein_cosmos_muted')") == '1'
        await s.page.evaluate("() => { CosmosAudio.prime(); window.__e = CosmosAudio.create(); __e.start(); }")
        assert await s.page.evaluate("__e.isMuted()") is True
        await s.page.wait_for_timeout(3500)
        assert await s.page.evaluate("__e.debug.masterGain()") < 0.01
    finally:
        await s.close()


async def test_dispose_closes():
    s = await open_page()
    try:
        state = await s.page.evaluate("async () => { CosmosAudio.prime(); const e = CosmosAudio.create(); e.start(); await e.dispose(); return e.debug.contextState(); }")
        assert state == 'closed', state
        fresh = await s.page.evaluate("() => CosmosAudio.prime().state")
        assert fresh != 'closed', fresh
    finally:
        await s.close()


async def test_update_all_eras():
    s = await open_page()
    try:
        await s.page.evaluate("""async () => { CosmosAudio.prime(); const e = CosmosAudio.create(); e.start();
            const P = CosmosPhysics;
            for (let k = 0; k <= 120; k++) { const t = P.sliderToTime(k / 120); e.update(t, P.eraAt(t).id, true, (k % 7) * 3);
              await new Promise(r => setTimeout(r, 16)); }
            await e.dispose(); }""")
        assert not s.errors, s.errors
    finally:
        await s.close()


run_tests(globals())
