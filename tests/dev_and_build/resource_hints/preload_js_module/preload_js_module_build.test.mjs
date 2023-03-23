import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const test = async (params) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    writeGeneratedFiles: true,
    ...params,
  })
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  })
  const { returnValue, pageLogs } = await executeInChromium({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  })
  const actual = {
    returnValue,
    pageLogs,
  }
  const expected = {
    returnValue: 42,
    pageLogs: [],
  }
  assert({ actual, expected })
}

// support for <script type="module">
// await test({ runtimeCompat: { chrome: "64" } })
// no support for <script type="module">
// await test({ runtimeCompat: { chrome: "60" } })
// no support + no versioning
await test({ runtimeCompat: { chrome: "60" }, versioning: false })
