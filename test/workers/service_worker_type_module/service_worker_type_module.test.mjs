import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
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
const { returnValue, serverOrigin } = await executeInChromium({
  rootDirectoryUrl: new URL("./dist/", import.meta.url),
  htmlFileRelativeUrl: "./main.html",
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
      url: `${serverOrigin}/sw.js`,
      inspectResponse: {
        order: [],
        serviceWorkerUrls: {
          "main.html": {
            versioned: false,
            version: "3dd88b43",
          },
          "css/style.css?v=5e0188f9": {
            versioned: true,
          },
        },
      },
    },
  }
  assert({ actual, expected })
}
