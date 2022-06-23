import { Script } from "node:vm"
import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const test = async (params) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    htmlSupervisor: true,
    ...params,
  })
  const { returnValue, pageLogs, pageErrors } = await executeInChromium({
    collectErrors: true,
    url: `${devServer.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: async () => {
      return window.__html_supervisor__.getScriptExecutionResults()
    },
    /* eslint-enable no-undef */
  })
  return { returnValue, server: devServer, pageLogs, pageErrors }
}

const { returnValue, pageLogs, pageErrors } = await test()
const error = new Script(returnValue.exceptionSource, {
  filename: "",
}).runInThisContext()

const actual = {
  pageLogs,
  pageErrors,
  error,
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
  error: new SyntaxError(
    `The requested module '/file.js' does not provide an export named 'answer'`,
  ),
}
assert({ actual, expected })
