import { assert } from "@jsenv/assert"
import { startDevServer } from "@jsenv/core"
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js"

import { jsenvPluginGlobals } from "@jsenv/plugin-globals"

const test = async (params) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
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
  const { returnValue } = await executeInBrowser({
    url: `${devServer.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  })
  const actual = returnValue
  const expected = { answer: 42 }
  assert({ actual, expected })
}

await test()
