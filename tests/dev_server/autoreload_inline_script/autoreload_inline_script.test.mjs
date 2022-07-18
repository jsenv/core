import { readFileSync, writeFileSync } from "node:fs"
import { chromium } from "playwright"
import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js"

const htmlFileUrl = new URL("./client/main.html", import.meta.url)
const htmlFileContent = {
  beforeTest: readFileSync(htmlFileUrl),
  update: (content) => writeFileSync(htmlFileUrl, content),
  restore: () => writeFileSync(htmlFileUrl, htmlFileContent.beforeTest),
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
  htmlFileContent.update(`<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
  </head>

  <body>
    <script>
      window.resultPromise = new Promise((resolve) => {
        window.resolveResultPromise = resolve
      })
    </script>
    <script type="module">
      window.resolveResultPromise(43)
    </script>
  </body>
</html>`)
  await page.waitForNavigation() // full reload
  {
    const actual = await getResult()
    const expected = 43
    assert({ actual, expected })
  }
} finally {
  browser.close()
  htmlFileContent.restore()
}
