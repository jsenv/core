import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, readFile } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import {
  findNodeByTagName,
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const mainFilename = `main.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${mainFilename}`
await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints: {
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
    textNodeValue:
      // on windows the sourcemap.sourcesContent contains \r\n
      // which creates an other hash on the sourcemap
      process.platform === "win32"
        ? actual.textNodeValue
        : `body {
  background: orange;
}

/*# sourceMappingURL=assets/style.css_938cb1c1.map */`,
  }
  assert({ actual, expected })
}
