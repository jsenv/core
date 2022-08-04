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
    collectErrors: true,
    url: `${devServer.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: async () => {
      return window.__supervisor__.getDocumentExecutionResult()
    },
    /* eslint-enable no-undef */
  })
  return { returnValue, server: devServer, pageLogs, pageErrors }
}

const { returnValue, pageLogs, pageErrors } = await test()

const actual = {
  pageLogs,
  pageErrors,
  errorMessage: returnValue.executionResults["/main.js"].exception.message,
}
const expected = {
  pageLogs: [],
  pageErrors: [
    Object.assign(
      new Error(
        `The requested module '/file.js' does not provide an export named 'answer'`,
      ),
      {
        name: "SyntaxError",
      },
    ),
  ],
  errorMessage: `The requested module '/file.js' does not provide an export named 'answer'`,
}
assert({ actual, expected })
