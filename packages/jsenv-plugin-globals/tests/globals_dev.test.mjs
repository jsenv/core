import { assert } from "@jsenv/assert"
import { startDevServer } from "@jsenv/core"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

import { jsenvPluginGlobals } from "@jsenv/plugin-globals"

const test = async (params) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    plugins: [
      jsenvPluginGlobals({
        "./main.js": () => {
          return {
            __answer__: 42,
          }
        },
      }),
    ],
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
  const actual = {
    returnValue,
  }
  const expected = {
    returnValue: { answer: 42 },
  }
  assert({ actual, expected })
}

await test()
