import { chromium, firefox, webkit } from "playwright"
import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js"

const devServer = await startDevServer({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
})

const test = async ({ browserLauncher }) => {
  const browser = await browserLauncher.launch({ headless: true })
  try {
    const page = await launchBrowserPage(browser)
    await page.goto(`${devServer.origin}/main.html`)
    const result = await page.evaluate(
      /* eslint-disable no-undef */
      () => {
        return window.resultPromise
      },
      /* eslint-enable no-undef */
    )
    // each browser dispatch "load" differently:
    // - chrome: after module script(s) and top level await execution
    // - firefox: after module scripts(s) loaded ignoring top level execution
    // - webkit: ignore module scripts(s)
    if (browserLauncher === chromium) {
      const actual = result
      const expected = [
        "before_js_classic_inline",
        "js_classic_inline",
        "before_js_classic_src",
        "js_classic",
        "js_module_inline",
        "js_module",
        "window_load_dispatched",
      ]
      assert({ actual, expected })
    }
    if (browserLauncher === firefox) {
      const actual = result
      const expected = [
        "before_js_classic_inline",
        "js_classic_inline",
        "before_js_classic_src",
        "js_classic",
        "js_module_inline",
        "window_load_dispatched", // "load" occurs before top level await is done
        "js_module",
      ]
      assert({ actual, expected })
    }
    if (browserLauncher === webkit) {
      const actual = result
      const expected = [
        "before_js_classic_inline",
        "js_classic_inline",
        "before_js_classic_src",
        "js_classic",
        "window_load_dispatched", // "load" occurs before module script(s)
        "js_module_inline",
        "js_module",
      ]
      assert({ actual, expected })
    }
  } finally {
    browser.close()
  }
}

await test({ browserLauncher: chromium })
await test({ browserLauncher: firefox })
await test({ browserLauncher: webkit })
