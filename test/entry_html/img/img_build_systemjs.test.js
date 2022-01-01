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
import {
  findNodeByTagName,
  getHtmlNodeAttributeByName,
  parseSrcset,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { GENERATE_SYSTEMJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `img.html`
const { buildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "main.html",
  },
})
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
const htmlString = await readFile(htmlBuildUrl)
const img = findNodeByTagName(htmlString, "img")

// ensure src is properly updated
{
  const srcAttribute = getHtmlNodeAttributeByName(img, "src")
  const imgABuildRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}img-a.png`]

  const actual = srcAttribute.value
  const expected = imgABuildRelativeUrl
  assert({ actual, expected })

  // ensure corresponding file exists
  const imgABuildUrl = resolveUrl(imgABuildRelativeUrl, buildDirectoryUrl)
  await assertFilePresence(imgABuildUrl)
}

// ensure srcset is properly updated
{
  const srcsetAttribute = getHtmlNodeAttributeByName(img, "srcset")
  const imgBBuildRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}img-b.png`]
  const imgCBuildRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}img-c.png`]

  const actual = parseSrcset(srcsetAttribute.value)
  const expected = [
    {
      specifier: imgBBuildRelativeUrl,
      descriptor: "200w",
    },
    {
      specifier: imgCBuildRelativeUrl,
      descriptor: "400w",
    },
  ]
  // and corresponding file exists
  assert({ actual, expected })

  const imgBBuildUrl = resolveUrl(imgBBuildRelativeUrl, buildDirectoryUrl)
  await assertFilePresence(imgBBuildUrl)
  const imgCBuildUrl = resolveUrl(imgCBuildRelativeUrl, buildDirectoryUrl)
  await assertFilePresence(imgCBuildUrl)
}
