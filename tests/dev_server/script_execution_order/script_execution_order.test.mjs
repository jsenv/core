/*
 * Ensures standard script execution order is preserved by jsenv supervisor
 */

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
    // this should be the order found in each browser
    // However on webkit it will be different because of a bug (https://twitter.com/damienmaillard/status/1554752482273787906)
    const correctOrder = [
      "before_js_classic_inline",
      "js_classic_inline",
      "before_js_classic_src",
      "js_classic_a",
      "js_classic_b",
      "js_module_inline",
      "js_module_a",
      "js_module_b",
      "window_load_dispatched",
      "js_module_a_after_top_level_await",
    ]

    if (browserLauncher === chromium) {
      const actual = result
      const expected = correctOrder
      assert({ actual, expected, context: `chromium` })
    }
    if (browserLauncher === firefox) {
      const actual = result
      const expected = correctOrder
      assert({ actual, expected, context: `firefox` })
    }
    if (browserLauncher === webkit) {
      // window "load" event is not deterministic on webkit due to
      // the bug mentioned previously, so remove it and ensure only the
      // js execution order is correct
      const actual = result
      const expected = [
        "before_js_classic_inline",
        "js_classic_inline",
        "before_js_classic_src",
        "js_classic_a",
        "js_classic_b",
        "window_load_dispatched",
        "js_module_inline",
        "js_module_a",
        "js_module_a_after_top_level_await",
        "js_module_b",
      ]
      assert({ actual, expected, context: `webkit` })
    }
  } finally {
    browser.close()
  }
}

await test({ browserLauncher: chromium })
// firefox super slow sometimes on windows
if (process.platform !== "win32") {
  await test({ browserLauncher: firefox })
}
await test({ browserLauncher: webkit })
