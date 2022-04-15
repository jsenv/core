import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { executeInChromium } from "@jsenv/core/test/execute_in_chromium.js"

const test = async (params) => {
  await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    babel: {
      // topLevelAwait: "ignore",
    },
    versioning: false,
    minification: false,
    ...params,
  })

  const { returnValue } = await executeInChromium({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
    htmlFileRelativeUrl: "./main.html",
    /* eslint-disable no-undef */
    pageFunction: async () => {
      return window.namespacePromise
    },
    /* eslint-enable no-undef */
  })
  return returnValue
}

// default (no support for worker_type_module)
{
  const actual = await test()
  const expected = {
    workerResponse: "pong",
    worker2Response: "pong",
  }
  assert({ actual, expected })
}

// without bundling
{
  const actual = await test({
    bundling: false,
  })
  const expected = {
    workerResponse: "pong",
    worker2Response: "pong",
  }
  assert({ actual, expected })
}

// with support for worker_type_module
{
  const actual = await test({
    runtimeCompat: {
      chrome: "81",
    },
  })
  const expected = {
    workerResponse: "pong",
    worker2Response: "pong",
  }
  assert({ actual, expected })
}

// with support + bundling
