import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
  assertFilePresence,
  urlToBasename,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  findNodeByTagName,
  getHtmlNodeAttributeByName,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${testDirectoryname}.html`]: "./main.html",
}

const { buildMappings } = await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  // logLevel: "debug",
})

// ensure link.href is properly updated
{
  const buildDirectoryUrl = resolveUrl(buildDirectoryRelativeUrl, jsenvCoreDirectoryUrl)
  const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
  const htmlString = await readFile(htmlBuildUrl)
  const link = findNodeByTagName(htmlString, "link")
  const hrefAttribute = getHtmlNodeAttributeByName(link, "href")
  const imgBuildRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}img.png`]

  const actual = hrefAttribute.value
  const expected = imgBuildRelativeUrl
  assert({ actual, expected })
  // ensure corresponding file exists
  const imgABuildUrl = resolveUrl(imgBuildRelativeUrl, buildDirectoryUrl)
  await assertFilePresence(imgABuildUrl)
}
