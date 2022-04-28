import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/test/start_file_server.js"
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
  return { returnValue }
}

// bundling
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

// bundling + no support for script_type_module
{
  const { returnValue } = await test({
    runtimeCompat: {
      chrome: "60",
    },
    versioning: false,
  })
  const actual = returnValue
  const expected = {
    data: {
      answer: 42,
    },
  }
  assert({ actual, expected })
}

// no bundling
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
