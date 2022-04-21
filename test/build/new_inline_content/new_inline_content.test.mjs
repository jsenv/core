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
const { returnValue, serverOrigin } = await executeInChromium({
  rootDirectoryUrl: new URL("./dist/", import.meta.url),
  htmlFileRelativeUrl: "./main.html",
  /* eslint-disable no-undef */
  pageFunction: async (jsRelativeUrl) => {
    const namespace = await import(jsRelativeUrl)

    // let 500ms for the background image to load
    await new Promise((resolve) => {
      setTimeout(resolve, 500)
    })
    const bodyBackgroundImage = getComputedStyle(document.body).backgroundImage

    return {
      ...namespace,
      bodyBackgroundImage,
    }
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
  background-image: url(/other/jsenv.png?v=25e95a00);
  background-image: url(/other/jsenv.png?v=25e95a00);
  background-image: url(/other/jsenv.png?v=25e95a00);
}
`,
  cssTextWithUrl: `\nbody { background-image: url(/other/jsenv.png?v=25e95a00); }\n`,
  cssTextWithUrl2: `\nbody { background-image: url(/other/jsenv.png?v=25e95a00); }\n`,
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
  whenInlined: `body { background-image: url(/other/jsenv.png?v=25e95a00); }`,
  whenRenamed: `body { background-image: url(/other/jsenv.png?v=25e95a00); }`,
  bodyBackgroundImage: `url("${serverOrigin}/other/jsenv.png?v=25e95a00")`,
}
assert({ actual, expected })
