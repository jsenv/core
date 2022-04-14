import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { executeInChromium } from "@jsenv/core/test/execute_in_chromium.js"

const test = async (params) => {
  const { buildManifest } = await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    babel: {
      topLevelAwait: "ignore",
    },
    // versioning: "none",
    // minification: false,
    // bundling: false,
    ...params,
  })

  const { returnValue } = await executeInChromium({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
    htmlFileRelativeUrl: "./main.html",
    /* eslint-disable no-undef */
    pageFunction: async (jsRelativeUrl) => {
      const namespace = await import(jsRelativeUrl)
      return namespace
    },
    /* eslint-enable no-undef */
    pageArguments: [`./${buildManifest["js/main.js"]}`],
  })
  return returnValue
}

// default (no support for worker_type_module)
{
  const actual = await test()
  const expected = {
    worker2Response: "pong",
    workerResponse: "pong",
  }
  assert({ actual, expected })
}

// with support for worker_type_module
// TODO
