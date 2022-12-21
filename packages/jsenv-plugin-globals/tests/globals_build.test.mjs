import { assert } from "@jsenv/assert"
import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

import { jsenvPluginGlobals } from "@jsenv/plugin-globals"

const test = async (params) => {
  await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    plugins: [
      jsenvPluginGlobals({
        "./main.js": () => {
          return {
            __answer__: 42,
          }
        },
      }),
    ],
    ...params,
  })
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  })
  const { returnValue } = await executeInChromium({
    url: `${server.origin}/main.html`,
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
    returnValue: { answer: 42 },
  }
  assert({ actual, expected })
}

// support for <script type="module">
await test({ runtimeCompat: { chrome: "64" } })
// no support for <script type="module">
await test({ runtimeCompat: { chrome: "62" } })