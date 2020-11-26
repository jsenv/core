import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  readFile,
  resolveUrl,
  assertFilePresence,
} from "@jsenv/util"
import { buildProject } from "@jsenv/core/index.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { parseCssUrls } from "@jsenv/core/src/internal/building/css/parseCssUrls.js"
import { GENERATE_SYSTEMJS_BUILD_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `style.css`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./style.css",
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
const cssBuildRelativeUrl = getBuildRelativeUrl("style.css")
const cssBuildUrl = resolveUrl(cssBuildRelativeUrl, buildDirectoryUrl)
const cssString = await readFile(cssBuildUrl)

// ensure font urls properly updated in css file
{
  const cssUrls = await parseCssUrls(cssString, cssBuildUrl)
  const fontSpecifier = cssUrls.urlDeclarations[0].specifier
  const fontBuildRelativeUrl = getBuildRelativeUrl("Roboto-Thin.ttf")
  const fontBuildUrl = resolveUrl(fontBuildRelativeUrl, buildDirectoryUrl)

  const actual = fontSpecifier
  const expected = urlToRelativeUrl(fontBuildUrl, cssBuildUrl)
  assert({ actual, expected })

  await assertFilePresence(fontBuildUrl)
}
