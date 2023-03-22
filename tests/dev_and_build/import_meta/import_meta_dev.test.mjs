import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const test = async (params) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    ...params,
  })
  const { returnValue } = await executeInChromium({
    url: `${devServer.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  })
  const actual = returnValue
  const expected = {
    meta: {
      url: `${devServer.origin}/main.js`,
      resolve: undefined,
      hot: {
        data: {},
        accept: undefined,
        dispose: undefined,
        decline: undefined,
        invalidate: undefined,
      },
    },
    url: `${devServer.origin}/main.js`,
    urlDestructured: `${devServer.origin}/main.js`,
    importMetaDev: true,
    importMetaTest: undefined,
    importMetaBuild: undefined,
  }
  assert({ actual, expected })
}

await test()
