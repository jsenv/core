import { Script } from "node:vm"
import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { executeInChromium } from "@jsenv/core/test/execute_in_chromium.js"

const test = async (params) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    omegaServerLogLevel: "error",
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

const { server, pageLogs, pageErrors, returnValue } = await test()
const error = new Script(returnValue.exceptionSource, {
  filename: "",
}).runInThisContext()
const actual = {
  pageLogs,
  pageErrors,
  error,
}
const expected = {
  pageLogs: [
    {
      type: "error",
      text: `Failed to load resource: the server responded with a status of 404 (no entry on filesystem)`,
    },
  ],
  pageErrors: [
    Object.assign(
      new Error(
        `Failed to fetch dynamically imported module: ${server.origin}/main.js`,
      ),
      {
        name: "TypeError",
      },
    ),
  ],
  error: new TypeError(
    `Failed to fetch dynamically imported module: ${server.origin}/main.js`,
  ),
}
assert({ actual, expected })
