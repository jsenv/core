import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const test = async (params) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    ...params,
  })
  const { returnValue } = await executeInChromium({
    url: `${devServer.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: async () => {
      return window.resultPromise
    },
    /* eslint-enable no-undef */
  })
  return { returnValue, server: devServer }
}

const { returnValue, server } = await test({
  versioning: false,
})
const actual = {
  returnValue,
}
const expected = {
  returnValue: {
    meta: {
      url: `${server.origin}/main.js`,
      resolve: undefined,
      hot: {
        data: {},
        accept: undefined,
        dispose: undefined,
        decline: undefined,
        invalidate: undefined,
      },
    },
    url: `${server.origin}/main.js`,
    urlDestructured: `${server.origin}/main.js`,
    importMetaDev: true,
    importMetaTest: undefined,
    importMetaBuild: undefined,
  },
}
assert({ actual, expected })
