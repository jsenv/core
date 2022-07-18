/*
 * Ensure server errors are dispatched to clients only if this page is responsible
 * for the error; unrelated pages must not display an error.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { chromium } from "playwright"
import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"

const jsFileUrl = new URL("./client/main.js", import.meta.url)
const jsFileContent = {
  beforeTest: readFileSync(jsFileUrl),
  update: (content) => writeFileSync(jsFileUrl, content),
  restore: () => writeFileSync(jsFileUrl, jsFileContent.beforeTest),
}
const devServer = await startDevServer({
  logLevel: "off",
  omegaServerLogLevel: "off",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
})

const browser = await chromium.launch({ headless: false })
const page = await browser.newPage({ ignoreHTTPSErrors: true })

try {
  await page.goto(`${devServer.origin}/main.html`)
  const getErrorOverlayDisplayedOnPage = async (page) => {
    const errorOverlayHandle = await page.evaluate(
      /* eslint-disable no-undef */
      () => {
        return document.querySelector("jsenv-error-overlay")
      },
      /* eslint-enable no-undef */
    )
    return Boolean(errorOverlayHandle)
  }

  {
    const actual = {
      displayed: await getErrorOverlayDisplayedOnPage(page),
    }
    const expected = {
      displayed: false,
    }
    assert({ actual, expected })
  }

  jsFileContent.update(`const j = (`)
  await new Promise((resolve) => {
    setTimeout(resolve, 500)
  })
  {
    const actual = {
      displayedAfterSyntaxError: await getErrorOverlayDisplayedOnPage(page),
    }
    const expected = {
      displayedAfterSyntaxError: true,
    }
    assert({ actual, expected })
  }
  jsFileContent.update(`const j = true`)
  await new Promise((resolve) => {
    setTimeout(resolve, 500)
  })
  {
    const actual = {
      displayedAfterFixAndAutoreload: await getErrorOverlayDisplayedOnPage(
        page,
      ),
    }
    const expected = {
      displayedAfterFixAndAutoreload: false,
    }
    assert({ actual, expected })
  }
} finally {
  jsFileContent.restore()
  // browser.close()
}
