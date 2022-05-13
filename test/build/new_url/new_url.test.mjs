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
      "./main.html": "main.html",
    },
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
  const actual = returnValue
  const expected = {
    textFileUrl: `${server.origin}/other/file.txt?v=64ec88ca`,
    absoluteUrl: `http://example.com/file.txt`,
    windowOriginRelativeUrl: `${server.origin}/other/file.txt?v=64ec88ca`,
    absoluteBaseUrl: `http://jsenv.dev/file.txt`,
  }
  assert({ actual, expected })
}

// support for <script type="module">
await test({
  runtimeCompat: {
    chrome: "63",
  },
  minification: true,
})

// no support for <script type="module">
await test({
  runtimeCompat: {
    chrome: "60",
  },
  minification: true,
})
