import { Script } from "node:vm"
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
  const { returnValue, pageLogs, pageErrors } = await executeInChromium({
    url: `${devServer.origin}/main.html`,
    collectConsole: true,
    collectErrors: true,
    /* eslint-disable no-undef */
    pageFunction: async () => {
      return window.__html_supervisor__.getScriptExecutionResults()
    },
    /* eslint-enable no-undef */
  })
  return { returnValue, server: devServer, pageLogs, pageErrors }
}

const { server, returnValue, pageLogs, pageErrors } = await test({})
const error = new Script(returnValue.exceptionSource, {
  filename: "",
}).runInThisContext()
const expectedErrorStack = `Error: SPECIAL_STRING_UNLIKELY_TO_COLLIDE
    at triggerError (${server.origin}/trigger_error.js:2:9)
    at ${server.origin}/main.js:3:1`
const actual = {
  error,
  errorStack: error.stack.slice(0, expectedErrorStack.length),
  pageLogs,
  pageErrors,
}
const expected = {
  error: new Error("SPECIAL_STRING_UNLIKELY_TO_COLLIDE"),
  errorStack: expectedErrorStack,
  pageLogs: [],
  pageErrors: [
    Object.assign(new Error("SPECIAL_STRING_UNLIKELY_TO_COLLIDE"), {
      name: "Error",
    }),
  ],
}
assert({ actual, expected })
