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
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `style.css`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./style.css",
}

const { buildMappings } = await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
})

const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const cssBuildRelativeUrl =
  buildMappings[`${testDirectoryRelativeUrl}style.css`]
const cssBuildUrl = resolveUrl(cssBuildRelativeUrl, buildDirectoryUrl)
const cssString = await readFile(cssBuildUrl)

// ensure font urls properly updated in css file
{
  const cssUrls = await parseCssUrls(cssString, cssBuildUrl)
  const fontSpecifier = cssUrls.atImports[0].specifier

  const actual = fontSpecifier
  const expected = "https://fonts.googleapis.com/css2?family=Roboto"
  assert({ actual, expected })
}
