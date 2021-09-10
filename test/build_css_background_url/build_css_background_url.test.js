import { assert } from "@jsenv/assert"
import {
  urlToBasename,
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { parseCssUrls } from "@jsenv/core/src/internal/building/css/parseCssUrls.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${testDirectoryname}.html`]: "./main.html",
}

const { buildMappings } = await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  minify: true,
})

const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const styleBuildRelativeUrl =
  buildMappings[`${testDirectoryRelativeUrl}style.css`]
const imgBuildRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}img.png`]
const styleBuildUrl = resolveUrl(styleBuildRelativeUrl, buildDirectoryUrl)
const imgBuildUrl = resolveUrl(imgBuildRelativeUrl, buildDirectoryUrl)

// ensure background image url is properly updated
{
  const styleCssString = await readFile(styleBuildUrl)
  const styleUrls = await parseCssUrls(styleCssString, styleBuildUrl)

  const actual = styleUrls.urlDeclarations[0].specifier
  const expected = urlToRelativeUrl(imgBuildUrl, styleBuildUrl)
  assert({ actual, expected })
}
