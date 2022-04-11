import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"

import { executeInChromium } from "@jsenv/core/test/execute_in_chromium.js"

const { buildManifest } = await build({
  logLevel: "warn",
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
  complexInsideDoubleQuotes: `\n'😀'\n`,
  complexInsideSingleQuotes: `\n"😀"\n`,
  cssAndTemplate: `
body {
  background-image: url(/assets/jsenv-25e95a00.png);
  background-image: url(/assets/jsenv-25e95a00.png);
  background-image: url(/assets/jsenv-25e95a00.png);
}
`,
  cssTextWithUrl: `\nbody { background-image: url(/assets/jsenv-25e95a00.png); }\n`,
  cssTextWithUrl2: `\nbody { background-image: url(/assets/jsenv-25e95a00.png); }\n`,
  doubleQuote: `"`,
  doubleQuoteEscaped: `"`,
  fromTemplate: `"`,
  fromTemplate2: `'`,
  fromTemplate3: `\n'"`,
  fromTemplate4: `
'"
`,
  lineEnding: `\n`,
  lineEnding2: `\n`,
  singleQuote: `'`,
  singleQuoteEscaped: `'`,
  whenInlined: `body { background-image: url(/assets/jsenv-25e95a00.png); }`,
  whenRenamed: `body { background-image: url(/assets/jsenv-25e95a00.png); }`,
}
assert({ actual, expected })
