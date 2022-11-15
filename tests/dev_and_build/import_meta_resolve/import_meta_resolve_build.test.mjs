import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const test = async ({ expectedFilename = "js/foo.js", ...rest }) => {
  await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    minification: false,
    versioning: false,
    // writeGeneratedFiles: true,
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
    importMetaResolveReturnValue: `${server.origin}/${expectedFilename}`,
    __TEST__: `${server.origin}/${expectedFilename}`,
  }
  assert({ actual, expected })
}

// module supported but import.meta.resolve is not
await test({
  runtimeCompat: {
    chrome: "80",
  },
})
// import.meta.resolve supported
await test({
  runtimeCompat: {
    chrome: "107",
  },
})
// script module not supported
await test({
  runtimeCompat: {
    chrome: "60",
  },
  expectedFilename: "js/foo.nomodule.js",
})