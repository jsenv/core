import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { executeInChromium } from "@jsenv/core/test/execute_in_chromium.js"

const test = async (options) => {
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
    ...options,
  })
  const { serverOrigin, returnValue } = await executeInChromium({
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
  return { serverOrigin, buildManifest, returnValue }
}

// with bundling (default)
{
  const { serverOrigin, buildManifest, returnValue } = await test()
  const actual = returnValue
  const expected = {
    bodyBackgroundColor: "rgb(255, 0, 0)",
    bodyBackgroundImage: `url("${serverOrigin}/assets/${buildManifest["js/main.js"]}")`,
  }
  assert({ actual, expected })
}

// without bundling
{
  const { serverOrigin, buildManifest, returnValue } = await test({
    bundling: false,
  })
  const actual = returnValue
  const expected = {
    bodyBackgroundColor: "rgb(255, 0, 0)",
    bodyBackgroundImage: `url("${serverOrigin}/assets/${buildManifest["js/main.js"]}")`,
  }
  assert({ actual, expected })
}
