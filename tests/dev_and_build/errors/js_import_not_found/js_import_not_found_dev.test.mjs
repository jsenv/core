import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

let warnCalls = []
const warn = console.warn
console.warn = (...args) => {
  warnCalls.push(args.join(""))
}
try {
  const devServer = await startDevServer({
    logLevel: "warn",
    serverLogLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    devServerAutoreload: false,
    port: 0,
  })
  const { returnValue, pageLogs, pageErrors } = await executeInChromium({
    url: `${devServer.origin}/main.html`,
    collectConsole: true,
    collectErrors: true,
    /* eslint-disable no-undef */
    pageFunction: () => window.__supervisor__.getDocumentExecutionResult(),
    /* eslint-enable no-undef */
  })

  const actual = {
    serverWarnOutput: warnCalls.join("\n"),
    pageLogs,
    pageErrors,
    errorMessage: returnValue.executionResults["/main.js"].exception.message,
  }
  const expected = {
    serverWarnOutput: `GET ${devServer.origin}/not_found.js
  [33m404[0m Failed to fetch url content
  --- reason ---
  no entry on filesystem
  --- url ---
  ${new URL("./client/not_found.js", import.meta.url).href}
  --- url reference trace ---
  ${new URL("./client/intermediate.js", import.meta.url)}:2:7
    1 | // eslint-disable-next-line import/no-unresolved
  > 2 | import "./not_found.js"
              ^
    3 | 
  --- plugin name ---
  "jsenv:file_url_fetching"`,
    pageLogs: [
      {
        type: "error",
        text: `Failed to load resource: the server responded with a status of 404 (no entry on filesystem)`,
      },
    ],
    pageErrors: [],
    errorMessage: `Failed to fetch module: ${devServer.origin}/main.js`,
  }
  assert({ actual, expected })
} finally {
  console.warn = warn
}
