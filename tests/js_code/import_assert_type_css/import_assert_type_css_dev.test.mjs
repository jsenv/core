import { chromium, firefox, webkit } from "playwright"
import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js"

const devServer = await startDevServer({
  logLevel: "warn",
  keepProcessAlive: false,
  rootDirectoryUrl: new URL("./client/", import.meta.url),
})
const test = async ({ browserLauncher }) => {
  const browser = await browserLauncher.launch({ headless: true })
  const page = await launchBrowserPage(browser)
  await page.goto(`${devServer.origin}/main.html`)

  const result = await page.evaluate(
    /* eslint-disable no-undef */
    () => {
      return window.resultPromise
    },
    /* eslint-enable no-undef */
  )
  const actual = result
  const expected = {
    bodyBackgroundColor: "rgb(255, 0, 0)",
    bodyBackgroundImage: `url("${devServer.origin}/src/jsenv.png")`,
  }
  assert({ actual, expected })
  browser.close()
}

await test({
  browserLauncher: chromium,
})
await test({
  browserLauncher: firefox,
})
await test({
  browserLauncher: webkit,
})
