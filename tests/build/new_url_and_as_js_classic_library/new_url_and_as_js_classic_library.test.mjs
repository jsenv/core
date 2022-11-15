import { copyFileSync } from "node:fs"
import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const test = async (params) => {
  await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    assetsDirectory: "foo/",
    entryPoints: {
      "./main.js?as_js_classic_library": "main.js",
    },
    writeGeneratedFiles: true,
    minification: false,
    ...params,
  })
  copyFileSync(
    new URL("./main.html", import.meta.url),
    new URL("./dist/main.html", import.meta.url),
  )
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
  const actual = returnValue
  const expected = `${server.origin}/foo/other/file.txt?v=e3b0c442`
  assert({ actual, expected })
}

// support for <script type="module">
await test({ runtimeCompat: { chrome: "66" } })