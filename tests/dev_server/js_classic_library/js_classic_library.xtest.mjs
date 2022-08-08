/*
 * in development
 */

import { chromium } from "playwright"
import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js"

const debug = false // true to have browser UI + keep it open after test
const devServer = await startDevServer({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  clientAutoreload: false,
  supervisor: false,
})
const browser = await chromium.launch({ headless: !debug })
try {
  const page = await launchBrowserPage(browser)
  await page.goto(`${devServer.origin}/main.html`)
  const getResult = async () => {
    const result = await page.evaluate(
      /* eslint-disable no-undef */
      () => {
        return window.answer
      },
      /* eslint-enable no-undef */
    )
    return result
  }

  {
    const actual = await getResult()
    const expected = 42
    assert({ actual, expected })
  }

  // TODO
  // - reload the page
  // - ensure the response is served from cache
  // (the jsenv server must no re-apply rollup)

  // TODO:
  // - update dep.js to export 43
  // - reload the page
  // - ensure result is 43
  // await page.reload()
} finally {
  if (!debug) {
    browser.close()
  }
}
