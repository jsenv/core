import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  readFile,
  resolveUrl,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { parseCssUrls } from "@jsenv/core/src/internal/building/css/parseCssUrls.js"
import {
  findHtmlNodeById,
  getHtmlNodeAttributeByName,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `preload_local_font.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: `./${mainFilename}`,
}
const { buildMappings } = await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
})
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const cssFileBuildRelativeUrl =
  buildMappings[`${testDirectoryRelativeUrl}style.css`]
const cssFileBuildUrl = resolveUrl(cssFileBuildRelativeUrl, buildDirectoryUrl)
const cssString = await readFile(cssFileBuildUrl)

// ensure link href is correct
{
  const htmlBuildUrl = resolveUrl(`${mainFilename}`, buildDirectoryUrl)
  const htmlString = await readFile(htmlBuildUrl)
  const fontPreloadLink = findHtmlNodeById(htmlString, "font_preload_link")
  const hrefAttribute = getHtmlNodeAttributeByName(fontPreloadLink, "href")
  const href = hrefAttribute.value

  const actual = href
  const expected = "assets/roboto_v27_latin_regular-cc46322d.woff2"
  assert({
    actual,
    expected,
  })
}

// ensure font urls properly updated in css file
{
  const cssUrls = await parseCssUrls(cssString, cssFileBuildUrl)
  const fontSpecifier = cssUrls.urlDeclarations[0].specifier

  const actual = fontSpecifier
  const expected = "roboto_v27_latin_regular-cc46322d.woff2"
  assert({ actual, expected })
}
