import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/test/start_file_server.js"
import { executeInChromium } from "@jsenv/core/test/execute_in_chromium.js"

await build({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
  minification: false,
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
if (process.platform !== "win32") {
  const actual = returnValue
  const expected = {
    serviceWorker: {
      url: `${server.origin}/sw.js`,
      inspectResponse: {
        order: [],
        serviceWorkerUrls: {
          "/main.html": {
            versioned: false,
            version: "6eb0b37f",
          },
          "/css/style.css?v=0e312da1": {
            versioned: true,
          },
        },
      },
    },
  }
  assert({ actual, expected })
}
