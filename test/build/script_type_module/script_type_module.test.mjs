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
    versioning: false,
    minification: false,
    ...params,
  })

  const { returnValue, serverOrigin } = await executeInChromium({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
    htmlFileRelativeUrl: "./main.html",
    /* eslint-disable no-undef */
    pageFunction: async () => {
      return window.namespacePromise
    },
    /* eslint-enable no-undef */
  })
  return { returnValue, serverOrigin }
}

// default
{
  const { returnValue, serverOrigin } = await test()
  const actual = returnValue
  const expected = {
    answer: 42,
    url: `${serverOrigin}/js/main.js`,
  }
  assert({ actual, expected })
}

// no support for <script type="module">
{
  const { returnValue, serverOrigin } = await test({
    runtimeCompat: {
      chrome: "60",
    },
  })
  const actual = returnValue
  const expected = {
    answer: 42,
    url: `${serverOrigin}/js/main.es5.js`,
  }
  assert({ actual, expected })
}

// no support + without bundling
{
  const { returnValue, serverOrigin } = await test({
    runtimeCompat: {
      chrome: "60",
    },
    bundling: false,
  })
  const actual = returnValue
  const expected = {
    answer: 42,
    url: `${serverOrigin}/js/main.es5.js`,
  }
  assert({ actual, expected })
}
