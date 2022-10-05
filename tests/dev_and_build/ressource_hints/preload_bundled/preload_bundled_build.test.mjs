import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const warnCalls = []
console.warn = (...args) => {
  warnCalls.push(args.join(""))
}

const test = async (params) => {
  warnCalls.length = 0
  await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    minification: false,
    writeGeneratedFiles: true,
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
    warnCalls,
    returnValue,
    pageLogs,
  }
  const expected = {
    warnCalls: [
      `remove resource hint on "${
        new URL("./client/file.js", import.meta.url).href
      }" because it was bundled`,
    ],
    returnValue: 42,
    pageLogs: [],
  }
  assert({ actual, expected })
}

// support for <script type="module">
await test({ runtimeCompat: { chrome: "64" } })
// no support for <script type="module">
// await test({ runtimeCompat: { chrome: "60" } })
