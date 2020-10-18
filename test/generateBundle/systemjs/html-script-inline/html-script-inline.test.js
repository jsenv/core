import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl, readFile, resolveUrl } from "@jsenv/util"
import { generateBundle } from "@jsenv/core/index.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  getJavaScriptSourceMappingUrl,
  setJavaScriptSourceMappingUrl,
} from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import {
  getNodeByTagName,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const bundleDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `${testDirectoryname}.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
}

await generateBundle({
  ...GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  bundleDirectoryRelativeUrl,
  entryPointMap,
  minify: true,
})

const bundleDirectoryUrl = resolveUrl(bundleDirectoryRelativeUrl, jsenvCoreDirectoryUrl)
const htmlBundleUrl = resolveUrl("main.html", bundleDirectoryUrl)
const htmlString = await readFile(htmlBundleUrl)
const scriptNode = getNodeByTagName(htmlString, "script")

const textNode = getHtmlNodeTextNode(scriptNode)
const text = textNode.value

// ensure text content is correct
{
  const source = setJavaScriptSourceMappingUrl(text, null)
  const actual = source.trim()
  const expected = `const a=12;console.log(a);`
  assert({ actual, expected })
}

// now ensure sourcemap file content looks good
{
  const sourcemappingUrl = getJavaScriptSourceMappingUrl(text)
  const sourcemapUrl = resolveUrl(sourcemappingUrl, htmlBundleUrl)
  const sourcemapString = await readFile(sourcemapUrl)
  const sourcemap = JSON.parse(sourcemapString)
  const htmlUrl = resolveUrl(mainFilename, testDirectoryUrl)
  const htmlString = await readFile(htmlUrl)
  const scriptNode = getNodeByTagName(htmlString, "script")
  const textNode = getHtmlNodeTextNode(scriptNode)
  const sourceContent = textNode.value
  const actual = sourcemap
  const expected = {
    version: 3,
    sources: ["../../html-script-inline.10.js"],
    names: actual.names,
    mappings: actual.mappings,
    sourcesContent: [sourceContent],
    file: actual.file,
  }
  assert({ actual, expected })
}
