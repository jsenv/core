import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const test = async (params) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    ...params,
  })
  const { returnValue } = await executeInChromium({
    url: `${devServer.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: async () => {
      return window.resultPromise
    },
    /* eslint-enable no-undef */
  })
  const actual = returnValue
  const expected = [
    "before_js_classic_inline",
    "js_classic_inline",
    "after_js_classic_inline",
    "before_js_classic_src",
    "js_classic",
    "after_js_classic_src",
    "window_load_dispatched",
    "js_module_inline",
    "js_module",
  ]
  assert({ actual, expected })
}

await test()
