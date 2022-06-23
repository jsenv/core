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
    transpilation: {
      // topLevelAwait: "ignore",
    },
    minification: false,
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
    workerResponse: "pong",
    worker2Response: "pong",
  }
  assert({ actual, expected })
}

// support for {type: "module"} in new Worker
await test({
  runtimeCompat: {
    chrome: "81",
  },
})

// no support for {type: "module"} in new Worker
await test({
  runtimeCompat: {
    chrome: "79",
  },
})

// no support for <script type="modue">
await test({
  runtimeCompat: {
    chrome: "62",
  },
})

// support + no bundling
await test({
  runtimeCompat: {
    chrome: "81",
  },
  bundling: false,
})

// no support + no bundling
await test({
  runtimeCompat: {
    chrome: "79",
  },
  bundling: false,
})
