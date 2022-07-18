/*
 * Ensure server errors are dispatched to clients only if this page is responsible
 * for the error; unrelated pages must not display an error.
 */

import { chromium } from "playwright"
import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"

const devServer = await startDevServer({
  logLevel: "off",
  omegaServerLogLevel: "off",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  plugins: [
    {
      name: "plugin_throwing",
      appliesDuring: "*",
      transformUrlContent: ({ url }) => {
        if (url.includes("error.js")) {
          throw new Error("error_during_transform")
        }
      },
    },
  ],
})

const browser = await chromium.launch({ headless: true })
const pageUnrelated = await browser.newPage({ ignoreHTTPSErrors: true })
const pageGeneratingError = await browser.newPage({ ignoreHTTPSErrors: true })
const pageRelated = await browser.newPage({ ignoreHTTPSErrors: true })

try {
  await pageUnrelated.goto(`${devServer.origin}/unrelated.html`)
  await pageUnrelated.evaluate(
    /* eslint-disable no-undef */
    () => {
      return window.resultPromise
    },
    /* eslint-enable no-undef */
  )

  await pageGeneratingError.goto(`${devServer.origin}/error.html`)
  await pageGeneratingError.waitForSelector("jsenv-error-overlay")
  await pageGeneratingError.mouse.click(0, 0) // close jsenv-error-overlay
  {
    const actual = await pageGeneratingError.evaluate(
      /* eslint-disable no-undef */
      () => {
        return document.querySelector("jsenv-error-overlay")
      },
      /* eslint-enable no-undef */
    )
    const expected = null
    assert({ actual, expected })
  }

  // regen the server error on an other page
  await pageRelated.goto(`${devServer.origin}/related.html`)
  // ensure:
  // - jsenv error overlay is displayed on this page
  // - it is also displayed on the other page using the same ressource (despites being closed)
  // - it is not displayed on page not depending on this file
  await pageGeneratingError.waitForSelector("jsenv-error-overlay", {
    timeout: 3000,
  })
  await pageRelated.waitForSelector("jsenv-error-overlay", {
    timeout: 3000,
  })
  {
    const actual = await pageUnrelated.evaluate(
      /* eslint-disable no-undef */
      () => {
        return document.querySelector("jsenv-error-overlay")
      },
      /* eslint-enable no-undef */
    )
    const expected = null
    assert({ actual, expected })
  }
} finally {
  browser.close()
}
