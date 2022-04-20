import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"

import { executeInChromium } from "@jsenv/core/test/execute_in_chromium.js"

const { buildManifest, buildInlineFileContents } = await build({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
  bundling: false,
  versioning: false,
})
const { returnValue } = await executeInChromium({
  rootDirectoryUrl: new URL("./dist/", import.meta.url),
  htmlFileRelativeUrl: "./main.html",
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
{
  const actual = {
    returnValue,
    buildInlineFileContents,
  }
  const expected = {
    returnValue: {
      data: { answer: 42 },
    },
    buildInlineFileContents: {
      // this is to assert JSON string does not contain whitespaces
      "js/main.js@L1C31-L1C53.json": '{"answer":42}',
    },
  }
  assert({ actual, expected })
}
