import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { executeInChromium } from "@jsenv/core/test/execute_in_chromium.js"

const test = async (options) => {
  await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    minification: false,
    ...options,
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
  return { returnValue }
}

// with bundling (default)
{
  const { returnValue } = await test()
  const actual = returnValue
  const expected = {
    data: {
      answer: 42,
    },
  }
  assert({ actual, expected })
}

// without bundling
{
  const { returnValue } = await test({
    bundling: false,
  })
  const actual = returnValue
  const expected = {
    data: {
      answer: 42,
    },
  }
  assert({ actual, expected })
}
