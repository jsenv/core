import { basename } from "path"
import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
  urlToFilename,
} from "@jsenv/filesystem"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  findNodeByTagName,
  getHtmlNodeAttributeByName,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { getJavaScriptSourceMappingUrl } from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import {
  GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { browserImportSystemJsBuild } from "@jsenv/core/test/browserImportSystemJsBuild.js"
import { buildProject } from "@jsenv/core"

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
const scriptBuildRelativeUrl = getBuildRelativeUrl("index.es5.js")
const scriptBuildUrl = resolveUrl(scriptBuildRelativeUrl, buildDirectoryUrl)
const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
const htmlString = await readFile(htmlBuildUrl)
const scriptNode = findNodeByTagName(htmlString, "script")
const sourcemapBuildRelativeUrl = getBuildRelativeUrl("index.es5.js.map")
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
  const sourcemap = JSON.parse(sourcemapString)
  const actual = {
    file: sourcemap.file,
    sources: sourcemap.sources,
  }
  const expected = {
    file: urlToFilename(scriptBuildUrl),
    sources: ["../../../index.source.js"],
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
