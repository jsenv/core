import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { GENERATE_SYSTEMJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { executeInBrowser } from "@jsenv/core/test/execute_in_browser.js"

import {
  findHtmlNodeById,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/compile_server/html/html_ast.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const { buildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}importmap_and_dynamic_import.html`]:
      "main.html",
  },
  // minify: true,
})
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)

// importmap content
{
  const htmlBuildFileUrl = resolveUrl("main.html", buildDirectoryUrl)
  const html = await readFile(htmlBuildFileUrl)
  const importmapHtmlNode = findHtmlNodeById(html, "importmap")
  const importmapTextNode = getHtmlNodeTextNode(importmapHtmlNode)
  const importmapString = importmapTextNode.value
  const importmap = JSON.parse(importmapString)
  const fooBuildRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}foo.js`]

  const actual = importmap
  const expected = {
    imports: {
      // the importmap for foo is available
      "./foo.js": `./${fooBuildRelativeUrl}`,
      // and nothing more because js is referencing only an other js
    },
  }
  assert({ actual, expected })
}

// assert asset url is correct for javascript (remapped + hashed)
{
  const jsBuildRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}file.js`]
  const { returnValue } = await executeInBrowser({
    directoryUrl: new URL("./", import.meta.url),
    htmlFileRelativeUrl: "./dist/systemjs/main.html",
    /* eslint-disable no-undef */
    pageFunction: (jsBuildRelativeUrl) => {
      return window.System.import(jsBuildRelativeUrl)
    },
    /* eslint-enable no-undef */
    pageArguments: [`./${jsBuildRelativeUrl}`],
  })
  const actual = returnValue
  const expected = {
    value: 42,
  }
  assert({ actual, expected })
}
