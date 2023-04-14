import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
})
const { consoleOutput, pageErrors } = await executeInChromium({
  url: `${devServer.origin}/main.html`,
  /* eslint-disable no-undef */
  pageFunction: () => window.namespacePromise,
  /* eslint-enable no-undef */
  collectConsole: true,
})
const actual = {
  consoleOutputRaw: consoleOutput.raw,
  pageErrors,
}
const expected = {
  consoleOutputRaw: "", // ensure there is no warning about preload link not used
  pageErrors: [],
}
assert({ actual, expected })
