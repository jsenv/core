import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, readFile } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import {
  findNodeByTagName,
  getHtmlNodeAttributeByName,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { stringifyDataUrl } from "@jsenv/core/src/internal/dataUrl.utils.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const mainFilename = `main.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${mainFilename}`
const imgFileUrl = resolveUrl("img.png", testDirectoryUrl)

await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${fileRelativeUrl}`]: "main.html",
  },
})

// ensure src is properly inlined
{
  const buildDirectoryUrl = resolveUrl(
    buildDirectoryRelativeUrl,
    jsenvCoreDirectoryUrl,
  )
  const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
  const htmlString = await readFile(htmlBuildUrl)
  const imgBuffer = await readFile(imgFileUrl, { as: "buffer" })
  const img = findNodeByTagName(htmlString, "img")
  const srcAttribute = getHtmlNodeAttributeByName(img, "src")
  const hasJsenvForceInlineAttribute = Boolean(
    getHtmlNodeAttributeByName(img, "data-jsenv-force-inline"),
  )

  const actual = {
    src: srcAttribute.value,
    hasJsenvForceInlineAttribute,
  }
  const expected = {
    src: stringifyDataUrl({ mediaType: "image/png", data: imgBuffer }),
    hasJsenvForceInlineAttribute: false,
  }
  assert({ actual, expected })
}
