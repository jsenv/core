import { readFileSync, writeFileSync } from "node:fs"
import { assert } from "@jsenv/assert"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const test = async (params) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.js": "main.js?as_js_module_fallback",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  })
  writeFileSync(
    new URL("./dist/main.html", import.meta.url),
    readFileSync(new URL("./client/main.html", import.meta.url)),
  )
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  })
  const { returnValue } = await executeInChromium({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  })
  const actual = returnValue
  const expected = {
    typeofCurrentScript: "object",
    answer: 42,
    url: `${server.origin}/main.js?as_js_module_fallback`,
  }
  assert({ actual, expected })
}

// support for <script type="module">
await test({
  runtimeCompat: { chrome: "64" },
  plugins: [jsenvPluginBundling()],
})
// support for <script type="module"> + no bundling
await test({ runtimeCompat: { chrome: "64" } })
// without support for <script type="module">
await test({
  runtimeCompat: { chrome: "55" },
  plugins: [jsenvPluginBundling()],
})
