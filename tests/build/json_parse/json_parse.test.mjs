import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const { buildManifest, buildInlineContents } = await build({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
  bundling: false,
  versioning: false,
})
const server = await startFileServer({
  rootDirectoryUrl: new URL("./dist/", import.meta.url),
})
const { returnValue } = await executeInChromium({
  url: `${server.origin}/main.html`,
  /* eslint-disable no-undef */
  pageFunction: async (jsRelativeUrl) => {
    const namespace = await import(jsRelativeUrl)
    return {
      ...namespace,
    }
  },
  /* eslint-enable no-undef */
  pageArguments: [`./${buildManifest["js/main.js"]}`],
})
const actual = {
  returnValue,
  buildInlineContents,
}
const expected = {
  returnValue: {
    data: { answer: 42 },
  },
  buildInlineContents: {
    // this is to assert JSON string does not contain whitespaces
    "js/main.js@L1C31-L1C53.json": '{"answer":42}',
  },
}
assert({ actual, expected })
