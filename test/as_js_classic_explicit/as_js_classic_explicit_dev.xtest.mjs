import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { executeInChromium } from "@jsenv/core/test/execute_in_chromium.js"

const devServer = await startDevServer({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
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
    typeofCurrentScript: "object",
    answer: 42,
    url: `${devServer.origin}/main.js?as_js_classic`,
  },
}
assert({ actual, expected })
