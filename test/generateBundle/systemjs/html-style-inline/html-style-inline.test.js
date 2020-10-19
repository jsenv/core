import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
  urlToBasename,
} from "@jsenv/util"
import { generateBundle } from "@jsenv/core/index.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  getNodeByTagName,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import {
  getCssSourceMappingUrl,
  setCssSourceMappingUrl,
} from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = urlToBasename(testDirectoryUrl.slice(0, -1))
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
  minify: true,
})

const getBundleRelativeUrl = (urlRelativeToTestDirectory) => {
  const relativeUrl = `${testDirectoryRelativeUrl}${urlRelativeToTestDirectory}`
  const bundleRelativeUrl = bundleManifest[relativeUrl]
  return bundleRelativeUrl
}

const bundleDirectoryUrl = resolveUrl(bundleDirectoryRelativeUrl, jsenvCoreDirectoryUrl)
const htmlBundleUrl = resolveUrl("main.html", bundleDirectoryUrl)
const htmlString = await readFile(htmlBundleUrl)
const styleNode = getNodeByTagName(htmlString, "style")
const depBundleRelativeUrl = getBundleRelativeUrl("dep.css")
const depBundleUrl = resolveUrl(depBundleRelativeUrl, bundleDirectoryUrl)
const textNode = getHtmlNodeTextNode(styleNode)
const text = textNode.value

// ensure style text is correct
{
  const source = setCssSourceMappingUrl(text, null)
  const actual = source.trim()
  const expected = `@import "${depBundleRelativeUrl}";body{padding:10px}`
  assert({ actual, expected })
}

// now ensure sourcemap file content looks good
{
  const sourcemappingUrl = getCssSourceMappingUrl(text)
  const sourcemapUrl = resolveUrl(sourcemappingUrl, htmlBundleUrl)
  const sourcemapString = await readFile(sourcemapUrl)
  const sourcemap = JSON.parse(sourcemapString)
  const htmlUrl = resolveUrl(mainFilename, testDirectoryUrl)
  const htmlString = await readFile(htmlUrl)
  const styleNode = getNodeByTagName(htmlString, "style")
  const textNode = getHtmlNodeTextNode(styleNode)
  const sourceContent = textNode.value
  const actual = sourcemap
  const expected = {
    version: 3,
    sources: ["../../html-style-inline.7.css"],
    names: actual.names,
    mappings: actual.mappings,
    file: actual.file,
    sourcesContent: [sourceContent],
  }
  assert({ actual, expected })
}

// ensure dep file content is correct
const depFileContent = await readFile(depBundleUrl)
{
  const actual = setCssSourceMappingUrl(depFileContent, null).trim()
  const expected = `body{color:red}`
  assert({ actual, expected })
}
// ensure dep souremap is correct too
{
  const sourcemappingUrl = getCssSourceMappingUrl(depFileContent)
  const sourcemapUrl = resolveUrl(sourcemappingUrl, depBundleUrl)
  const sourcemapString = await readFile(sourcemapUrl)
  const sourcemap = JSON.parse(sourcemapString)
  const depUrl = resolveUrl("dep.css", testDirectoryUrl)
  const depSource = await readFile(depUrl)
  const actual = sourcemap
  const expected = {
    version: 3,
    sources: ["../../../dep.css"],
    names: actual.names,
    mappings: actual.mappings,
    file: actual.file,
    sourcesContent: [depSource],
  }
  assert({ actual, expected })
}
