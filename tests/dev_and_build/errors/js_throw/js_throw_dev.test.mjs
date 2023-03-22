import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const test = async (params) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    ...params,
  })
  const { returnValue, pageLogs, pageErrors } = await executeInChromium({
    url: `${devServer.origin}/main.html`,
    collectConsole: true,
    collectErrors: true,
    /* eslint-disable no-undef */
    pageFunction: () => window.__supervisor__.getDocumentExecutionResult(),
    /* eslint-enable no-undef */
  })
  const errorStack =
    returnValue.executionResults["/main.js"].exception.originalStack
  const actual = {
    errorStack,
    pageLogs,
    pageErrors,
  }
  const expected = {
    errorStack: `    at triggerError (${devServer.origin}/trigger_error.js:2:9)
    at ${devServer.origin}/main.js:3:1`,
    pageLogs: [],
    pageErrors: [
      Object.assign(new Error("SPECIAL_STRING_UNLIKELY_TO_COLLIDE"), {
        name: "Error",
      }),
    ],
  }
  assert({ actual, expected })
}

await test()
