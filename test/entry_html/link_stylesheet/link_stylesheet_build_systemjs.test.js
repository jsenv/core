import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
  assertFilePresence,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  findNodeByTagName,
  getHtmlNodeAttributeByName,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { parseCssUrls } from "@jsenv/core/src/internal/building/css/parseCssUrls.js"
import { GENERATE_SYSTEMJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `link_stylesheet.html`
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
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
const htmlString = await readFile(htmlBuildUrl)
const link = findNodeByTagName(htmlString, "link")
const maincssBuildRelativeUrl =
  buildMappings[`${testDirectoryRelativeUrl}style.css`]
const depcssBuildRelativeUrl =
  buildMappings[`${testDirectoryRelativeUrl}dir/dep.css`]
const mainCssBuildUrl = resolveUrl(maincssBuildRelativeUrl, buildDirectoryUrl)
const depCssBuildUrl = resolveUrl(depcssBuildRelativeUrl, buildDirectoryUrl)

// ensure link.href is properly updated
{
  const hrefAttribute = getHtmlNodeAttributeByName(link, "href")
  const actual = hrefAttribute.value
  const expected = maincssBuildRelativeUrl
  assert({ actual, expected })
  // ensure corresponding file exists
  const imgABuildUrl = resolveUrl(maincssBuildRelativeUrl, buildDirectoryUrl)
  await assertFilePresence(imgABuildUrl)
}

// ensure dep is properly updated in @import
{
  const mainCssString = await readFile(mainCssBuildUrl)
  const mainCssUrls = await parseCssUrls({
    code: mainCssString,
    url: mainCssBuildUrl,
  })
  const actual = mainCssUrls.atImports[0].specifier
  const expected = urlToRelativeUrl(depCssBuildUrl, mainCssBuildUrl)
  assert({ actual, expected })

  await assertFilePresence(depCssBuildUrl)
}
