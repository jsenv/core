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
  const { returnValue, pageLogs, pageErrors } = await executeInChromium({
    url: `${devServer.origin}/main.html`,
    collectConsole: true,
    collectErrors: true,
    /* eslint-disable no-undef */
    pageFunction: async () => {
      return window.__supervisor__.getDocumentExecutionResult()
    },
    /* eslint-enable no-undef */
  })
  const errorText = returnValue.executionResults["/main.js"].exception.text
  const actual = {
    pageLogs,
    pageErrors,
    errorText,
  }
  const expected = {
    pageLogs: [],
    pageErrors: [
      Object.assign(new Error("Unexpected end of input"), {
        name: "SyntaxError",
      }),
    ],
    errorText: "Unexpected end of input",
  }
  assert({ actual, expected })
}

await test()
