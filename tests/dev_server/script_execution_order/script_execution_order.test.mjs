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
      return window.executionOrder
    },
    /* eslint-enable no-undef */
  })
  const actual = {
    returnValue,
  }
  const expected = {
    returnValue: [
      "classic_inline_before_a",
      "classic_a",
      "classic_inline_after_a",
      "classic_after_module",
      "module_inline",
    ],
  }
  assert({ actual, expected })
}

await test()
