import { assert } from "@jsenv/assert"
import {
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
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const { buildMappings } = await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}css_background_url.html`]: "main.html",
  },
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
const styleCssString = await readFile(styleBuildUrl)
const styleUrls = await parseCssUrls({
  code: styleCssString,
  url: styleBuildUrl,
})

const actual = styleUrls.urlDeclarations[0].specifier
const expected = urlToRelativeUrl(imgBuildUrl, styleBuildUrl)
assert({ actual, expected })
