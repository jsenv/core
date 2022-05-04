import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/test/start_file_server.js"
import { executeInChromium } from "@jsenv/core/test/execute_in_chromium.js"

await build({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./a.js": "a.js",
    "./b.js": "b.js",
  },
  baseUrl: "/dist/",
})
const server = await startFileServer({
  rootDirectoryUrl: new URL("./", import.meta.url),
})
const aExecution = await executeInChromium({
  url: `${server.origin}/a.html`,
  /* eslint-disable no-undef */
  pageFunction: async () => {
    return window.resultPromise
  },
  /* eslint-enable no-undef */
})
const bExecution = await executeInChromium({
  url: `${server.origin}/b.html`,
  /* eslint-disable no-undef */
  pageFunction: async () => {
    return window.resultPromise
  },
  /* eslint-enable no-undef */
})
const actual = {
  aReturnValue: aExecution.returnValue,
  bReturnValue: bExecution.returnValue,
}
const expected = {
  aReturnValue: "a-shared",
  bReturnValue: "b-shared",
}
assert({ actual, expected })
