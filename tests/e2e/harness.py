"""Shared Playwright harness for the cosmos browser tests.

Usage in a test file:
    from harness import run_tests, open_page
    async def test_something(): ...
    run_tests(globals())
Each test function gets a fresh browser via `open_page()`. Prints PASS/FAIL per test and exits 1 on failure.
"""
import asyncio, os, sys, traceback
from playwright.async_api import async_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PAGE = 'file://' + os.path.join(ROOT, 'index.html')
CHROME = os.environ.get('CHROME_PATH', '/usr/bin/google-chrome')
ARGS = ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']


class Session:
    def __init__(self, pw, browser, page, errors):
        self.pw, self.browser, self.page, self.errors = pw, browser, page, errors

    async def close(self):
        await self.browser.close()
        await self.pw.stop()


async def open_page(hash='home', reduced_motion=False, viewport=(1280, 800), init_script=None):
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(executable_path=CHROME, args=ARGS)
    ctx = await browser.new_context(viewport={'width': viewport[0], 'height': viewport[1]},
                                    reduced_motion='reduce' if reduced_motion else 'no-preference')
    if init_script:
        await ctx.add_init_script(init_script)
    page = await ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errors.append('console: ' + m.text)
            if m.type == 'error' and 'ERR_' not in m.text and 'Failed to load' not in m.text else None)

    async def route(r):
        if r.request.url.startswith('file://'):
            await r.continue_()
        else:
            await r.abort()
    await page.route('**/*', route)
    await page.goto(PAGE + '#' + hash)
    await page.wait_for_timeout(600)
    return Session(pw, browser, page, errors)


def run_tests(ns):
    tests = [(k, v) for k, v in ns.items() if k.startswith('test_') and asyncio.iscoroutinefunction(v)]
    only = sys.argv[1:]
    failed = 0
    for name, fn in tests:
        if only and name not in only:
            continue
        try:
            asyncio.run(fn())
            print('PASS', name)
        except Exception:
            failed += 1
            print('FAIL', name)
            traceback.print_exc(limit=3)
    print('errors: none' if not failed else f'{failed} failed')
    sys.exit(1 if failed else 0)
