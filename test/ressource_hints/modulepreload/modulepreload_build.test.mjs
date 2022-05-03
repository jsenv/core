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
    minification: false,
    ...params,
  })
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  })
  const { returnValue, pageLogs } = await executeInChromium({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: async () => {
      return window.namespacePromise
    },
    /* eslint-enable no-undef */
  })
  return {
    returnValue,
    pageLogs,
  }
}

// support for <script type="module">
{
  const { returnValue, pageLogs } = await test()
  const actual = {
    returnValue,
    pageLogs,
  }
  const expected = {
    returnValue: {
      answer: 42,
    },
    pageLogs: [],
  }
  assert({ actual, expected })
}

// no support for <script type="module">
{
  const { returnValue, pageLogs } = await test({
    runtimeCompat: {
      chrome: "60",
    },
    versioningMethod: "filename",
  })
  const actual = {
    returnValue,
    pageLogs,
  }
  const expected = {
    returnValue: {
      answer: 42,
    },
    pageLogs: [],
  }
  assert({ actual, expected })
}
