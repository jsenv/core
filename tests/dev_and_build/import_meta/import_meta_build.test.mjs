import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const test = async ({ expectedBuildPath, ...rest }) => {
  await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    versioning: false,
    ...rest,
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
    meta: {
      url: `${server.origin}${expectedBuildPath}`,
      resolve: undefined,
    },
    url: `${server.origin}${expectedBuildPath}`,
    urlDestructured: `${server.origin}${expectedBuildPath}`,
    importMetaDev: undefined,
    importMetaTest: undefined,
    importMetaBuild: true,
  }

  assert({ actual, expected })
}

// can use <script type="module">
await test({
  expectedBuildPath: "/js/main.js",
  runtimeCompat: { chrome: "89" },
})
// cannot use <script type="module">
await test({
  expectedBuildPath: "/js/main.nomodule.js",
  runtimeCompat: { chrome: "60" },
})
