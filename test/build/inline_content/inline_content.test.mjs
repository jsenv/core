import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"

import { executeInChromium } from "@jsenv/core/test/execute_in_chromium.js"

const { buildManifest } = await build({
  logLevel: "debug",
  rootDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
})
const { returnValue } = await executeInChromium({
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
  //   cssTextA: `
  // body {
  //   background-color: red;
  //   background-image: url(/assets/jsenv-25e95a00.png);
  //   background-image: url(/assets/jsenv-25e95a00.png);
  //   background-image: url(/assets/jsenv-25e95a00.png);
  // }`,
  cssTextWithUrl: `body { background-image: url(/assets/jsenv-25e95a00.png); }`,
  cssTextWithUrl2: `body { background-image: url(/assets/jsenv-25e95a00.png); }`,
  doubleQuote: `"`,
  lineEnding: `\n`,
  lineEnding2: `\n`,
  singleQuote: `'`,
}
assert({ actual, expected })
