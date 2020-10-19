import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl, readFile, resolveUrl } from "@jsenv/util"
import { generateBundle } from "@jsenv/core/index.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  findAllNodeByTagName,
  getHtmlNodeAttributeByName,
  findNodeByTagName,
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
const svgBundleRelativeUrl = getBundleRelativeUrl("icon.svg")
const svgBundleUrl = resolveUrl(svgBundleRelativeUrl, bundleDirectoryUrl)
const pngBundleRelativeUrl = getBundleRelativeUrl("img.png")
const pngBundleUrl = resolveUrl(pngBundleRelativeUrl, bundleDirectoryUrl)
const htmlString = await readFile(htmlBundleUrl)
const [firstUseNodeInBundle, secondUseNodeInBundle] = findAllNodeByTagName(htmlString, "use")

// ensure first use is untouched
{
  const hrefAttribute = getHtmlNodeAttributeByName(firstUseNodeInBundle, "href")
  const actual = hrefAttribute.value
  const expected = "#icon-1"
  assert({ actual, expected })
}

// ensure second use.href is updated
{
  const hrefAttribute = getHtmlNodeAttributeByName(secondUseNodeInBundle, "href")
  const actual = hrefAttribute.value
  const expected = `${svgBundleRelativeUrl}#icon-1`
  assert({ actual, expected })
}

// ensure href in icon file is updated
{
  const svgString = await readFile(svgBundleUrl)
  const image = findNodeByTagName(svgString, "image")
  const hrefAttribute = getHtmlNodeAttributeByName(image, "href")
  const actual = hrefAttribute.value
  const expected = urlToRelativeUrl(pngBundleUrl, svgBundleUrl)
  assert({ actual, expected })
}
