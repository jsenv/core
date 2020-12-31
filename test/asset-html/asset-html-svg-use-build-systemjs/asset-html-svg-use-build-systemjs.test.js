import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl, readFile, resolveUrl } from "@jsenv/util"
import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  findAllNodeByTagName,
  getHtmlNodeAttributeByName,
  findNodeByTagName,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { GENERATE_SYSTEMJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `${testDirectoryname}.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
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
const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
const svgBuildRelativeUrl = getBuildRelativeUrl("icon.svg")
const svgBuildUrl = resolveUrl(svgBuildRelativeUrl, buildDirectoryUrl)
const pngBuildRelativeUrl = getBuildRelativeUrl("img.png")
const pngBuildUrl = resolveUrl(pngBuildRelativeUrl, buildDirectoryUrl)
const htmlString = await readFile(htmlBuildUrl)
const [firstUseNodeInBuild, secondUseNodeInBuild] = findAllNodeByTagName(htmlString, "use")

// ensure first use is untouched
{
  const hrefAttribute = getHtmlNodeAttributeByName(firstUseNodeInBuild, "href")
  const actual = hrefAttribute.value
  const expected = "#icon-1"
  assert({ actual, expected })
}

// ensure second use.href is updated
{
  const hrefAttribute = getHtmlNodeAttributeByName(secondUseNodeInBuild, "href")
  const actual = hrefAttribute.value
  const expected = `${svgBuildRelativeUrl}#icon-1`
  assert({ actual, expected })
}

// ensure href in icon file is updated
{
  const svgString = await readFile(svgBuildUrl)
  const image = findNodeByTagName(svgString, "image")
  const hrefAttribute = getHtmlNodeAttributeByName(image, "href")
  const actual = hrefAttribute.value
  const expected = urlToRelativeUrl(pngBuildUrl, svgBuildUrl)
  assert({ actual, expected })
}
