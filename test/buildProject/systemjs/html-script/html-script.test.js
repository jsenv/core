import { basename } from "path"
import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
  urlToFilename,
} from "@jsenv/util"
import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  findNodeByTagName,
  getHtmlNodeAttributeByName,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { getJavaScriptSourceMappingUrl } from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { browserImportSystemJsBuild } from "../browserImportSystemJsBuild.js"
import {
  GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
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
})

const getBuildRelativeUrl = (urlRelativeToTestDirectory) => {
  const relativeUrl = `${testDirectoryRelativeUrl}${urlRelativeToTestDirectory}`
  const buildRelativeUrl = buildMappings[relativeUrl]
  return buildRelativeUrl
}

const buildDirectoryUrl = resolveUrl(buildDirectoryRelativeUrl, jsenvCoreDirectoryUrl)
const scriptBuildRelativeUrl = getBuildRelativeUrl("index.js")
const scriptBuildUrl = resolveUrl(scriptBuildRelativeUrl, buildDirectoryUrl)
const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
const htmlString = await readFile(htmlBuildUrl)
const scriptNode = findNodeByTagName(htmlString, "script")
const sourcemapBuildRelativeUrl = getBuildRelativeUrl("index.js.map")
const sourcemapBuildUrl = resolveUrl(sourcemapBuildRelativeUrl, buildDirectoryUrl)

{
  const srcAttribute = getHtmlNodeAttributeByName(scriptNode, "src")
  const actual = srcAttribute.value
  const expected = scriptBuildRelativeUrl
  assert({ actual, expected })
}

// sourcemap file is copied too
{
  const scriptString = await readFile(scriptBuildUrl)
  const actual = getJavaScriptSourceMappingUrl(scriptString)
  const expected = urlToRelativeUrl(sourcemapBuildUrl, scriptBuildUrl)
  assert({ actual, expected })
}

// souremap file content
{
  const sourcemapString = await readFile(sourcemapBuildUrl)
  const actual = JSON.parse(sourcemapString)
  const expected = {
    file: urlToFilename(scriptBuildUrl),
    sources: ["../../../../../../whatever.js"],
  }
  assert({ actual, expected })
}

{
  const { namespace } = await browserImportSystemJsBuild({
    ...IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    codeToRunInBrowser: "window.whatever",
    mainRelativeUrl: `./${scriptBuildUrl}`,
    // debug: true,
  })
  const actual = namespace
  const expected = 42
  assert({ actual, expected })
}
