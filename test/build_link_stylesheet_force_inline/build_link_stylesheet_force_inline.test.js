import { assert } from "@jsenv/assert"
import {
  resolveUrl,
  urlToRelativeUrl,
  urlToBasename,
  readFile,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import {
  findNodeByTagName,
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const mainFilename = `${testDirectoryname}.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${mainFilename}`
const entryPointMap = {
  [`./${fileRelativeUrl}`]: "./main.html",
}
await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
})

// ensure src is properly inlined
{
  const buildDirectoryUrl = resolveUrl(
    buildDirectoryRelativeUrl,
    jsenvCoreDirectoryUrl,
  )
  const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
  const htmlString = await readFile(htmlBuildUrl)
  const style = findNodeByTagName(htmlString, "style")
  const relAttribute = getHtmlNodeAttributeByName(style, "rel")
  const forceInlineAttribute = getHtmlNodeAttributeByName(
    style,
    "data-jsenv-force-inline",
  )
  const textNode = getHtmlNodeTextNode(style)

  const actual = {
    relAttribute,
    forceInlineAttribute,
    textNodeValue: textNode.value,
  }
  const expected = {
    relAttribute: undefined,
    forceInlineAttribute: undefined,
    textNodeValue: `body {
  background: orange;
}

/*# sourceMappingURL=style-ec00ed36.css.map */`,
  }
  assert({ actual, expected })
}
