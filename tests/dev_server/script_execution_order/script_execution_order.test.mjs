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
    const correctOrder = [
      "before_js_classic_inline",
      "js_classic_inline",
      "before_js_classic_src",
      "js_classic",
      "js_module_inline",
      "js_module",
      "window_load_dispatched",
    ]
    // because of the webkit bug (https://twitter.com/damienmaillard/status/1554752482273787906)
    // jsenv has to resort to dynamic import on webkit so the order differs

    if (browserLauncher === chromium) {
      const actual = result
      const expected = correctOrder
      assert({ actual, expected })
    }
    if (browserLauncher === firefox) {
      const actual = result
      const expected = correctOrder
      assert({ actual, expected })
    }
    if (browserLauncher === webkit) {
      // window "load" event is not deterministic on webkit due to
      // the bug mentioned previously, so remove it and ensure only the
      // js execution order is correct
      const actual = result.filter((v) => v !== "window_load_dispatched")
      const expected = correctOrder.filter(
        (v) => v !== "window_load_dispatched",
      )
      assert({ actual, expected })
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
