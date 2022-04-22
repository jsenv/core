import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/test/start_file_server.js"
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

  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  })
  const { returnValue } = await executeInChromium({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: async () => {
      return window.namespacePromise
    },
    /* eslint-enable no-undef */
  })
  return { returnValue, server }
}

// default
{
  const { returnValue, server } = await test()
  const actual = returnValue
  const expected = {
    answer: 42,
    url: `${server.origin}/js/main.js`,
  }
  assert({ actual, expected })
}

// no support for <script type="module">
{
  const { returnValue, server } = await test({
    runtimeCompat: {
      chrome: "60",
    },
  })
  const actual = returnValue
  const expected = {
    answer: 42,
    url: `${server.origin}/js/main.es5.js`,
  }
  assert({ actual, expected })
}

// no support + without bundling
{
  const { returnValue, server } = await test({
    runtimeCompat: {
      chrome: "60",
    },
    bundling: false,
  })
  const actual = returnValue
  const expected = {
    answer: 42,
    url: `${server.origin}/js/main.es5.js`,
  }
  assert({ actual, expected })
}
