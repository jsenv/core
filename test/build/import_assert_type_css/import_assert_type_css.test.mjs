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
    minification: false,
    ...options,
  })
  const { serverOrigin, returnValue } = await executeInChromium({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
    htmlFileRelativeUrl: "./main.html",
    /* eslint-disable no-undef */
    pageFunction: async () => {
      return window.namespacePromise
    },
    /* eslint-enable no-undef */
  })
  return { serverOrigin, buildManifest, returnValue }
}

// with bundling (default)
{
  const { serverOrigin, buildManifest, returnValue } = await test()
  const actual = returnValue
  const expected = {
    bodyBackgroundColor: "rgb(255, 0, 0)",
    bodyBackgroundImage: `url("${serverOrigin}/${buildManifest["assets/jsenv.png"]}")`,
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
    bodyBackgroundImage: `url("${serverOrigin}/${buildManifest["assets/jsenv.png"]}")`,
  }
  assert({ actual, expected })
}

// minification
{
  const { buildInlineContents } = await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    babel: {
      topLevelAwait: "ignore",
    },
    minification: {
      js: false,
      css: true,
    },
  })
  const cssKey = Object.keys(buildInlineContents).find((key) =>
    key.endsWith(".css"),
  )
  const actual = buildInlineContents[cssKey]
  const expected = `body{background-color:red;background-image:url('+__v__("/assets/jsenv.png")+')}`
  assert({ actual, expected })
}
