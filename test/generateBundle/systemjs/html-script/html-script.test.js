import { basename } from "path"
import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
  urlToFilename,
} from "@jsenv/util"
import { generateBundle } from "@jsenv/core/index.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  findNodeByTagName,
  getHtmlNodeAttributeByName,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { getJavaScriptSourceMappingUrl } from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { browserImportSystemJsBundle } from "../browserImportSystemJsBundle.js"
import {
  GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const bundleDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `${testDirectoryname}.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
}

const { bundleManifest } = await generateBundle({
  ...GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  bundleDirectoryRelativeUrl,
  entryPointMap,
})

const getBundleRelativeUrl = (urlRelativeToTestDirectory) => {
  const relativeUrl = `${testDirectoryRelativeUrl}${urlRelativeToTestDirectory}`
  const bundleRelativeUrl = bundleManifest[relativeUrl]
  return bundleRelativeUrl
}

const bundleDirectoryUrl = resolveUrl(bundleDirectoryRelativeUrl, jsenvCoreDirectoryUrl)
const scriptBundleRelativeUrl = getBundleRelativeUrl("index.js")
const scriptBundleUrl = resolveUrl(scriptBundleRelativeUrl, bundleDirectoryUrl)
const htmlBundleUrl = resolveUrl("main.html", bundleDirectoryUrl)
const htmlString = await readFile(htmlBundleUrl)
const scriptNode = findNodeByTagName(htmlString, "script")
const sourcemapBundleRelativeUrl = getBundleRelativeUrl("index.js.map")
const sourcemapBundleUrl = resolveUrl(sourcemapBundleRelativeUrl, bundleDirectoryUrl)

{
  const srcAttribute = getHtmlNodeAttributeByName(scriptNode, "src")
  const actual = srcAttribute.value
  const expected = scriptBundleRelativeUrl
  assert({ actual, expected })
}

// sourcemap file is copied too
{
  const scriptString = await readFile(scriptBundleUrl)
  const actual = getJavaScriptSourceMappingUrl(scriptString)
  const expected = urlToRelativeUrl(sourcemapBundleUrl, scriptBundleUrl)
  assert({ actual, expected })
}

// souremap file content
{
  const sourcemapString = await readFile(sourcemapBundleUrl)
  const actual = JSON.parse(sourcemapString)
  const expected = {
    file: urlToFilename(scriptBundleUrl),
    sources: ["../../../../../../whatever.js"],
  }
  assert({ actual, expected })
}

{
  const { namespace } = await browserImportSystemJsBundle({
    ...IMPORT_SYSTEM_JS_BUNDLE_TEST_PARAMS,
    testDirectoryRelativeUrl,
    codeToRunInBrowser: "window.whatever",
    mainRelativeUrl: `./${scriptBundleUrl}`,
    // debug: true,
  })
  const actual = namespace
  const expected = 42
  assert({ actual, expected })
}
