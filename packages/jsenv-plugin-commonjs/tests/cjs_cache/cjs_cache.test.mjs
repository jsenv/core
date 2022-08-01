import { writeFileSync, readFileSync } from "node:fs"
import { chromium } from "playwright"
import { assert } from "@jsenv/assert"
import { ensureEmptyDirectory } from "@jsenv/filesystem"
import { startDevServer } from "@jsenv/core"
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js"

import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs"

const debug = false // true to have browser UI + keep it open after test
await ensureEmptyDirectory(
  new URL("./client/.jsenv/cjs_to_esm", import.meta.url),
)
const cjsFileUrl = new URL("./client/dep.cjs", import.meta.url)
const cjsFileContent = {
  beforeTest: readFileSync(cjsFileUrl),
  update: (content) => writeFileSync(cjsFileUrl, content),
  restore: () => writeFileSync(cjsFileUrl, cjsFileContent.beforeTest),
}
const devServer = await startDevServer({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  plugins: [
    jsenvPluginCommonJs({
      include: {
        "./file.cjs": true,
      },
    }),
  ],
  clientAutoreload: false,
  supervisor: false,
})
const browser = await chromium.launch({
  headless: !debug,
})
try {
  const page = await launchBrowserPage(browser)
  await page.goto(`${devServer.origin}/main.html`)

  const getResult = async () => {
    const result = await page.evaluate(
      /* eslint-disable no-undef */
      () => {
        return window.resultPromise
      },
      /* eslint-enable no-undef */
    )
    return result
  }

  {
    const actual = {
      result: await getResult(),
    }
    const expected = {
      result: 42,
    }
    assert({ actual, expected })
  }

  // now update the package content + version and see if reloading the page updates the result
  {
    cjsFileContent.update(`module.exports = 43`)
    await page.reload()
    const actual = {
      result: await getResult(),
    }
    const expected = {
      result: 43,
    }
    assert({ actual, expected })
  }
} finally {
  if (!debug) {
    browser.close()
  }
  cjsFileContent.restore()
}
