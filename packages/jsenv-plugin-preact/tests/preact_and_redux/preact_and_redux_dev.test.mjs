import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js"
import { plugins } from "./jsenv_config.mjs"

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  plugins,
})
const { returnValue } = await executeInBrowser({
  url: `${devServer.origin}/main.html`,
  /* eslint-disable no-undef */
  pageFunction: () => window.resultPromise,
  /* eslint-enable no-undef */
})
const actual = returnValue
const expected = {
  spanContentAfterIncrement: "1",
  spanContentAfterDecrement: "0",
}
assert({ actual, expected })
