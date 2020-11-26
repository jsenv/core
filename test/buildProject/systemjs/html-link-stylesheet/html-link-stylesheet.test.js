import { basename } from "path"
import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
  assertFilePresence,
} from "@jsenv/util"
import { buildProject } from "@jsenv/core/index.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  findNodeByTagName,
  getHtmlNodeAttributeByName,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { parseCssUrls } from "@jsenv/core/src/internal/building/css/parseCssUrls.js"
import { GENERATE_SYSTEMJS_BUILD_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `${testDirectoryname}.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
}

const { bundleMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
})

const getBundleRelativeUrl = (urlRelativeToTestDirectory) => {
  const relativeUrl = `${testDirectoryRelativeUrl}${urlRelativeToTestDirectory}`
  const bundleRelativeUrl = bundleMappings[relativeUrl]
  return bundleRelativeUrl
}

const buildDirectoryUrl = resolveUrl(buildDirectoryRelativeUrl, jsenvCoreDirectoryUrl)
const htmlBundleUrl = resolveUrl("main.html", buildDirectoryUrl)
const htmlString = await readFile(htmlBundleUrl)
const link = findNodeByTagName(htmlString, "link")
const mainCssBundleRelativeUrl = getBundleRelativeUrl("style.css")
const depCssBundleRelativeUrl = getBundleRelativeUrl("dir/dep.css")
const mainCssBundleUrl = resolveUrl(mainCssBundleRelativeUrl, buildDirectoryUrl)
const depCssBundleUrl = resolveUrl(depCssBundleRelativeUrl, buildDirectoryUrl)

// ensure link.href is properly updated
{
  const hrefAttribute = getHtmlNodeAttributeByName(link, "href")
  const actual = hrefAttribute.value
  const expected = mainCssBundleRelativeUrl
  assert({ actual, expected })
  // ensure corresponding file exists
  const imgABundleUrl = resolveUrl(mainCssBundleRelativeUrl, buildDirectoryUrl)
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
