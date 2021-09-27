import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
  urlToBasename,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { browserImportSystemJsBuild } from "@jsenv/core/test/browserImportSystemJsBuild.js"
import {
  findHtmlNodeById,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `${testDirectoryname}.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
}
const { buildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
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
  const fileBuildRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}file.js`]
  const fooBuildRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}foo.js`]

  const actual = importmap
  const expected = {
    imports: {
      // the importmap for foo is available
      "./file.js": `./${fileBuildRelativeUrl}`,
      "./foo.js": `./${fooBuildRelativeUrl}`,
      // and nothing more because js is referencing only an other js
    },
  }
  assert({ actual, expected })
}

// assert asset url is correct for javascript (remapped + hashed)
{
  const mainRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}file.js`]
  const { namespace } = await browserImportSystemJsBuild({
    ...IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    mainRelativeUrl: `./${mainRelativeUrl}`,
    // debug: true,
  })
  const actual = namespace
  const expected = {
    value: 42,
  }
  assert({ actual, expected })
}
