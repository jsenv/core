import { assert } from "@jsenv/assert"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const test = async (options) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),

    writeGeneratedFiles: true,
    ...options,
  })
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
    data: { answer: 42 },
  }
  assert({ actual, expected })
}

// support for <script type="module">
await test({
  runtimeCompat: { chrome: "64" },
  plugins: [jsenvPluginBundling()],
})
// no support <script type="module">
await test({
  runtimeCompat: { chrome: "60" },
  plugins: [jsenvPluginBundling()],
})
// support for <script type="module"> + no bundling
await test({
  runtimeCompat: { chrome: "64" },
  versioning: false,
})
