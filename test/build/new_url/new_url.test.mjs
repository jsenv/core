import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { executeInChromium } from "@jsenv/core/test/execute_in_chromium.js"

const { buildManifest } = await build({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
  minification: false,
})
const { serverOrigin, returnValue } = await executeInChromium({
  rootDirectoryUrl: new URL("./dist/", import.meta.url),
  htmlFileRelativeUrl: "./main.html",
  /* eslint-disable no-undef */
  pageFunction: async (jsRelativeUrl) => {
    const namespace = await import(jsRelativeUrl)
    return namespace
  },
  /* eslint-enable no-undef */
  pageArguments: [`./${buildManifest["js/main.js"]}`],
})
const actual = returnValue
const expected = {
  absoluteBaseUrl: `http://jsenv.dev/file.txt`,
  absoluteUrl: `http://example.com/file.txt`,
  textFileUrl: `${serverOrigin}/other/file.txt?v=64ec88ca`,
  windowOriginRelativeUrl: `${serverOrigin}/other/file.txt?v=64ec88ca`,
}
assert({ actual, expected })
