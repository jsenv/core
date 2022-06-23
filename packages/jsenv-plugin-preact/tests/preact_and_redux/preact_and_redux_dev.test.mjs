import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"
import { plugins } from "./jsenv_config.mjs"

const devServer = await startDevServer({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  plugins,
})
const { returnValue } = await executeInChromium({
  url: `${devServer.origin}/main.html`,
  /* eslint-disable no-undef */
  pageFunction: async () => {
    return window.resultPromise
  },
  /* eslint-enable no-undef */
})
const actual = {
  returnValue,
}
const expected = {
  returnValue: {
    spanContentAfterIncrement: "1",
    spanContentAfterDecrement: "0",
  },
}
assert({ actual, expected })
