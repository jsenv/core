import { assert } from "@jsenv/assert"
import { startDevServer } from "@jsenv/core"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

import { jsenvPluginPlaceholders } from "@jsenv/plugin-placeholders"

const test = async (params) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    plugins: [
      jsenvPluginPlaceholders({
        "./main.js": (urlInfo, context) => {
          return {
            __DEMO__: context.dev ? "dev" : "build",
          }
        },
      }),
    ],
    ...params,
  })
  const { returnValue } = await executeInChromium({
    url: `${devServer.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  })

  const actual = returnValue
  const expected = "dev"
  assert({ actual, expected })
}

await test()
