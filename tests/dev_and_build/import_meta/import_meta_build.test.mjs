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
  return { returnValue, server }
}

{
  const { returnValue, server } = await test({
    versioning: false,
  })
  const actual = {
    returnValue,
  }
  const expected = {
    returnValue: {
      meta: {
        url: `${server.origin}/js/main.js`,
        resolve: undefined,
      },
      url: `${server.origin}/js/main.js`,
      urlDestructured: `${server.origin}/js/main.js`,
      importMetaDev: undefined,
      importMetaTest: undefined,
      importMetaBuild: true,
    },
  }
  assert({ actual, expected })
}

// no support for <script type="module">
{
  const { returnValue, server } = await test({
    versioning: false,
    runtimeCompat: {
      chrome: "60",
    },
  })
  const actual = {
    returnValue,
  }
  const expected = {
    returnValue: {
      meta: {
        url: `${server.origin}/js/main.nomodule.js`,
        resolve: undefined,
      },
      url: `${server.origin}/js/main.nomodule.js`,
      urlDestructured: `${server.origin}/js/main.nomodule.js`,
      importMetaDev: undefined,
      importMetaTest: undefined,
      importMetaBuild: true,
    },
  }
  assert({ actual, expected })
}
