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
  const { returnValue } = await executeInChromium({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: async () => {
      return window.resultPromise
    },
    /* eslint-enable no-undef */
  })
  return returnValue.inspectResponse
}

if (process.platform === "darwin") {
  const actual = await test()
  const expected = {
    order: ["before-a", "before-b", "b", "after-b", "after-a"],
    serviceWorkerUrls: {
      "/main.html": {
        versioned: false,
        version: "6d62f00a",
      },
      "/css/style.css?v=0e312da1": {
        versioned: true,
      },
      "/js/a.js?v=fa03702c": {
        versioned: true,
      },
      "/js/b.js?v=f4808298": {
        versioned: true,
      },
    },
  }
  assert({ actual, expected })
}
