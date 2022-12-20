import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

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
    answer: 42,
  }
  assert({ actual, expected })
}

// support for <script type="module">
await test({
  runtimeCompat: { chrome: "64" },
})
// no support <script type="module">
await test({
  runtimeCompat: { chrome: "60" },
  // At some point generating sourcemap in this scenario was throwing an error
  // because the sourcemap for js module files where not generated
  // and in the end code was expecting to find sourcemapUrlInfo.content
  // What should happen instead is that js modules files are gone, so their sourcemap
  // should not appear in the url graph.
  // We generate sourcemap here to ensure there won't be a regression on that
  sourcemaps: "file",
})
