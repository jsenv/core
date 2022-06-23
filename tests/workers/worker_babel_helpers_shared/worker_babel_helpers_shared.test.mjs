/*
 * The goal is to test that babel helper are shared
 * in an independent chunk to avoid pulling code from the app into the worker
 * If that was happening window.toto = true in "main.js"
 * whould throw in the worker context
 */

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
    transpilation: {
      // topLevelAwait: "ignore",
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
  const actual = returnValue
  const expected = {
    workerResponse: 42,
  }
  assert({ actual, expected })
}

await test({
  runtimeCompat: {
    edge: "17", // force object-rest-spread
  },
})
