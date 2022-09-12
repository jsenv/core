import { readFileSync, writeFileSync } from "node:fs"
import { chromium } from "playwright"
import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js"

const mainJsFileUrl = new URL("./client/main.html", import.meta.url)
const mainJsFileContent = {
  beforeTest: readFileSync(mainJsFileUrl),
  update: (content) => writeFileSync(mainJsFileUrl, content),
  restore: () => writeFileSync(mainJsFileUrl, mainJsFileContent.beforeTest),
}

const devServer = await startDevServer({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  cooldownBetweenFileEvents: 250,
  clientFiles: {
    "./**": true,
    "./**/.*/": false,
  },
})
const browser = await chromium.launch({ headless: true })
try {
  const page = await launchBrowserPage(browser)
  await page.goto(`${devServer.origin}/main.html`)
  const getResult = async () => {
    const result = await page.evaluate(
      /* eslint-disable no-undef */
      () => window.resultPromise,
      /* eslint-enable no-undef */
    )
    return result
  }

  {
    const actual = await getResult()
    const expected = 42
    assert({ actual, expected })
  }
  mainJsFileContent.update(
    String(mainJsFileContent.beforeTest).replace(
      "export const answer = 42",
      "export const answer = 43",
    ),
  )
  await page.waitForNavigation() // full reload
  {
    const actual = await getResult()
    const expected = 43
    assert({ actual, expected })
  }
} finally {
  mainJsFileContent.restore()
  browser.close()
}
