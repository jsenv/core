import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/test/start_file_server.js"
import { executeInChromium } from "@jsenv/core/test/execute_in_chromium.js"

await build({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
  minification: false,
})
const server = await startFileServer({
  rootDirectoryUrl: new URL("./dist/", import.meta.url),
})
const { returnValue, pageLogs } = await executeInChromium({
  url: `${server.origin}/main.html`,
  /* eslint-disable no-undef */
  pageFunction: async () => {
    return window.namespacePromise
  },
  /* eslint-enable no-undef */
})
const actual = {
  returnValue,
  pageLogs,
}
const expected = {
  returnValue: {
    fontFamily: "Roboto",
  },
  pageLogs: [],
}
assert({ actual, expected })
