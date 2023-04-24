import { copyFileSync } from "node:fs"
import { assert } from "@jsenv/assert"
import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js"

const test = async (params) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.js?as_js_classic": "main.js",
    },
    assetsDirectory: "foo/",
    plugins: [jsenvPluginAsJsClassic()],
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  })
  copyFileSync(
    new URL("./main.html", import.meta.url),
    new URL("./dist/main.html", import.meta.url),
  )
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
  const expected = `${server.origin}/foo/other/file.txt?v=e3b0c442`
  assert({ actual, expected })
}

// support for <script type="module">
await test({ runtimeCompat: { chrome: "66" } })
