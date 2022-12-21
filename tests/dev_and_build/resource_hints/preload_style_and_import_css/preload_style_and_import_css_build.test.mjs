import { assert } from "@jsenv/assert"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const test = async (params) => {
  await build({
    logLevel: "error",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    versioning: false,
    ...params,
  })
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  })
  const { returnValue, pageLogs } = await executeInChromium({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: async () => {
      return window.resultPromise
    },
    /* eslint-enable no-undef */
  })
  const actual = {
    returnValue,
    pageLogs,
  }
  const expected = {
    returnValue: "20px",
    pageLogs: [],
  }
  assert({ actual, expected })
}

// support for <script type="module">
await test({
  runtimeCompat: { chrome: "64" },
  plugins: [jsenvPluginBundling()],
})
// no support for <script type="module"> + no bundling
await test({ runtimeCompat: { chrome: "62" } })
