import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { parseCssUrls } from "@jsenv/core/src/internal/transform_css/parse_css_urls.js"
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
  entryPoints: {
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
  url: styleBuildUrl,
  content: styleCssString,
})

const actual = styleUrls[0].specifier
const expected = urlToRelativeUrl(imgBuildUrl, styleBuildUrl)
assert({ actual, expected })
