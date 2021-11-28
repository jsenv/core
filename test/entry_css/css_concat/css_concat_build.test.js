import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  readFile,
  resolveUrl,
  assertFilePresence,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { parseCssUrls } from "@jsenv/core/src/internal/building/css/parseCssUrls.js"
import { GENERATE_SYSTEMJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/`
const { buildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}main.css`]: "./main_build.css",
  },
  cssConcatenation: true,
})
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)

// ensure:
// 1. css files are concatened
// 2. filter with # is untouched
// 3. url to jsenv.png is correct and hashed

const cssBuildUrl = resolveUrl("style_build.css", buildDirectoryUrl)
const cssString = await readFile(cssBuildUrl)

// ensure font urls properly updated in css file
const cssUrls = await parseCssUrls({ code: cssString, url: cssBuildUrl })
const fontSpecifier = cssUrls.urlDeclarations[0].specifier
const fontBuildRelativeUrl =
  buildMappings[`${testDirectoryRelativeUrl}roboto_thin.ttf`]
const fontBuildUrl = resolveUrl(fontBuildRelativeUrl, buildDirectoryUrl)

const actual = fontSpecifier
const expected = urlToRelativeUrl(fontBuildUrl, cssBuildUrl)
assert({ actual, expected })

await assertFilePresence(fontBuildUrl)
