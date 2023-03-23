import { writeFileSync, readFileSync } from "node:fs"
import { chromium } from "playwright"
import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js"

const debug = false // true to have browser UI + keep it open after test to inspect things
const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  clientAutoreload: false,
  supervisor: false,
})
const browser = await chromium.launch({ headless: !debug })
const jsFileUrl = new URL("./client/dep.js", import.meta.url)
const jsFileContent = {
  beforeTest: readFileSync(jsFileUrl),
  update: (content) => writeFileSync(jsFileUrl, content),
  restore: () => writeFileSync(jsFileUrl, jsFileContent.beforeTest),
}
try {
  const page = await launchBrowserPage(browser)
  const responses = []
  page.on("response", (response) => {
    responses.push(response)
  })
  await page.goto(`${devServer.origin}/main.html`)
  const getResult = async () => {
    const result = await page.evaluate(
      /* eslint-disable no-undef */
      () => window.answer,
      /* eslint-enable no-undef */
    )
    return result
  }

  {
    const actual = await getResult()
    const expected = 42
    assert({ actual, expected })
  }

  // reloading page = 304
  {
    responses.length = 0
    await page.reload()
    const responseForJsFile = responses.find(
      (response) =>
        response.url() === `${devServer.origin}/main.js?as_js_classic_library`,
    )
    const jsFileResponseStatus = responseForJsFile.status()
    const answer = await getResult()
    const actual = {
      jsFileResponseStatus,
      answer,
    }
    const expected = {
      jsFileResponseStatus: 304,
      answer: 42,
    }
    assert({ actual, expected })
  }

  {
    jsFileContent.update(`export const answer = 43`)
    await new Promise((resolve) => setTimeout(resolve, 150))
    await page.reload()
    const actual = await getResult()
    const expected = 43
    assert({ actual, expected })
  }
} finally {
  jsFileContent.restore()
  if (!debug) {
    browser.close()
  }
}
