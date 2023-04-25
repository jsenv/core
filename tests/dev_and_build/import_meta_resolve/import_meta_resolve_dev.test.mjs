import { chromium, firefox } from "playwright"
import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js"

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  keepProcessAlive: false,
})

const test = async ({ browserLauncher }) => {
  const { returnValue } = await executeInBrowser({
    browserLauncher,
    url: `${devServer.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  })
  const actual = returnValue
  const expected = {
    importMetaResolveReturnValue: `${devServer.origin}/node_modules/foo/foo.js?js_classic&v=0.0.1`,
    __TEST__: `${devServer.origin}/node_modules/foo/foo.js?js_classic&v=0.0.1`,
  }
  assert({ actual, expected })
}

await test({ browserLauncher: chromium })
await test({ browserLauncher: firefox })
