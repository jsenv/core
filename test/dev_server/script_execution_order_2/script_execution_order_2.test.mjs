import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { executeInChromium } from "@jsenv/core/test/execute_in_chromium.js"

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
      await new Promise((resolve) => {
        setTimeout(resolve, 1000)
      })
      return window.executionOrder
    },
    /* eslint-enable no-undef */
  })
  const actual = {
    returnValue,
  }
  const expected = {
    returnValue: ["module_inline_2", "module_inline"],
  }
  assert({ actual, expected })
}

await test()
