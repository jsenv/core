import { readFileSync, writeFileSync } from "node:fs"
import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/test/start_file_server.js"
import { executeInChromium } from "@jsenv/core/test/execute_in_chromium.js"

const test = async (params) => {
  await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.js": "main.js?as_js_classic",
    },
    writeGeneratedFiles: true,
    minification: false,
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
    pageFunction: async () => {
      return window.resultPromise
    },
    /* eslint-enable no-undef */
  })
  const actual = returnValue
  const expected = {
    typeofCurrentScript: "object",
    answer: 42,
    url: `${server.origin}/main.js?as_js_classic`,
  }
  assert({ actual, expected })
}

// no bundling and support for <script type="module">
await test({
  runtimeCompat: {
    chrome: "63",
  },
  bundling: false,
})

// bundling and support for <script type="module">
await test({
  runtimeCompat: {
    chrome: "63",
  },
})

// without support for <script type="module">
await test({
  runtimeCompat: {
    chrome: "55",
  },
})
