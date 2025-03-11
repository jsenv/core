import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  readFile,
  resolveUrl,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import {
  findHtmlNodeById,
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"
import { GENERATE_SYSTEMJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { executeInBrowser } from "@jsenv/core/test/execute_in_browser.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `main.html`
const { buildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "main.html",
  },
  systemJsName: "toto",
  // minify: true,
})
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
const htmlString = await readFile(htmlBuildUrl)

// systemjs is inlined (no http request needed)
{
  const systemJsScript = findHtmlNodeById(htmlString, "jsenv_inject_systemjs")
  const srcAttribute = getHtmlNodeAttributeByName(systemJsScript, "src")

  const actual = srcAttribute
  const expected = undefined
  assert({ actual, expected })
}

// importmap is inlined
{
  const importmapScript = findHtmlNodeById(htmlString, "importmap")
  const srcAttribute = getHtmlNodeAttributeByName(importmapScript, "src")
  const textNode = getHtmlNodeTextNode(importmapScript)

  const actual = {
    srcAttribute,
    mappings: JSON.parse(textNode.value),
  }
  const expected = {
    srcAttribute: undefined,
    mappings: {
      imports: {
        "./file.js": `./${buildMappings[`${testDirectoryRelativeUrl}file.js`]}`,
      },
    },
  }
  assert({ actual, expected })
}

// file executes properly
{
  const { returnValue } = await executeInBrowser({
    directoryUrl: new URL("./", import.meta.url),
    htmlFileRelativeUrl: "./dist/systemjs/main.html",
    /* eslint-disable no-undef */
    pageFunction: async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 500)
      })

      return {
        hello: window.hello,
        answer: window.answer,
      }
    },
    /* eslint-enable no-undef */
  })
  const actual = returnValue
  const expected = {
    hello: true,
    answer: 42,
  }
  assert({ actual, expected })
}
