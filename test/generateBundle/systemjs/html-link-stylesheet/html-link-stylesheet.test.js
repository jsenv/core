import { basename } from "path"
import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
  assertFilePresence,
} from "@jsenv/util"
import { generateBundle } from "@jsenv/core/index.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  getNodeByTagName,
  getHtmlNodeAttributeByName,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { parseCssUrls } from "@jsenv/core/src/internal/bundling/css/parseCssUrls.js"
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
const htmlBundleUrl = resolveUrl("main.html", bundleDirectoryUrl)
const htmlString = await readFile(htmlBundleUrl)
const link = getNodeByTagName(htmlString, "link")
const mainCssBundleRelativeUrl = getBundleRelativeUrl("style.css")
const depCssBundleRelativeUrl = getBundleRelativeUrl("dir/dep.css")
const mainCssBundleUrl = resolveUrl(mainCssBundleRelativeUrl, bundleDirectoryUrl)
const depCssBundleUrl = resolveUrl(depCssBundleRelativeUrl, bundleDirectoryUrl)

// ensure link.href is properly updated
{
  const hrefAttribute = getHtmlNodeAttributeByName(link, "href")
  const actual = hrefAttribute.value
  const expected = mainCssBundleRelativeUrl
  assert({ actual, expected })
  // ensure corresponding file exists
  const imgABundleUrl = resolveUrl(mainCssBundleRelativeUrl, bundleDirectoryUrl)
  await assertFilePresence(imgABundleUrl)
}

// ensure dep is properly updated in @import
{
  const mainCssString = await readFile(mainCssBundleUrl)
  const mainCssUrls = await parseCssUrls(mainCssString, mainCssBundleUrl)
  const actual = mainCssUrls.atImports[0].specifier
  const expected = urlToRelativeUrl(depCssBundleUrl, mainCssBundleUrl)
  assert({ actual, expected })

  await assertFilePresence(depCssBundleUrl)
}
