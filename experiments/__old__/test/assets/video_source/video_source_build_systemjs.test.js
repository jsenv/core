import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  readFile,
  resolveUrl,
  assertFilePresence,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import {
  findNodeByTagName,
  getHtmlNodeAttributeByName,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"
import { GENERATE_SYSTEMJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `video_source.html`
const { buildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "main.html",
  },
})
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
const videoBuildRelativeUrl =
  buildMappings[`${testDirectoryRelativeUrl}video.mp4`]
const videoBuildUrl = resolveUrl(videoBuildRelativeUrl, buildDirectoryUrl)
const htmlString = await readFile(htmlBuildUrl)
const sourceNode = findNodeByTagName(htmlString, "source")

// ensure source.src is properly updated
{
  const srcAttribute = getHtmlNodeAttributeByName(sourceNode, "src")
  const actual = srcAttribute.value
  const expected = videoBuildRelativeUrl
  assert({ actual, expected })
  // ensure corresponding file exists
  await assertFilePresence(videoBuildUrl)
}
