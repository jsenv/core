import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js"

const test = async (options) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    // bundling: false,
    versioning: false,
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...options,
  })
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  })
  const { returnValue } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  })
  const actual = returnValue
  const expected = {
    data: { answer: 42 },
  }
  assert({ actual, expected })
}

// support for <script type="module">
await test({ runtimeCompat: { chrome: "64" } })
// no support for <script type="module">
await test({ runtimeCompat: { chrome: "60" } })
