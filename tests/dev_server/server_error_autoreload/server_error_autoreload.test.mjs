/*
 * Test the following:
 * - a script[hot-accept] can hot reload when supervised
 * - Introducing a syntax error displays the error overlay
 * - Fixing the syntax error removes the error overlay
 */

import { readFileSync, writeFileSync } from "node:fs"
import { chromium } from "playwright"
import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"

const htmlFileUrl = new URL("./client/main.html", import.meta.url)
const htmlFileContent = {
  beforeTest: readFileSync(htmlFileUrl),
  update: (content) => writeFileSync(htmlFileUrl, content),
  restore: () => writeFileSync(htmlFileUrl, htmlFileContent.beforeTest),
}
const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  clientFiles: {
    "**/*": true,
  },
  keepProcessAlive: false,
})

const browser = await chromium.launch({ headless: true })
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

  htmlFileContent.update(`<!DOCTYPE html>
  <html>
    <head>
      <title>Title</title>
      <meta charset="utf-8" />
      <link rel="icon" href="data:," />
    </head>
  
    <body>
      <style>
        body {
          background: red
        }
      </style>
    </body>
  </html>`)
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
  htmlFileContent.restore()
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
  htmlFileContent.restore()
  browser.close()
  devServer.stop() // required because for some reason the rooms are kept alive
}
