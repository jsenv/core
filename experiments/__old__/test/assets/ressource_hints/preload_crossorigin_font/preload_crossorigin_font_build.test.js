import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, readFile } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import {
  findNode,
  getHtmlNodeAttributeByName,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const { buildMappings } = await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}main.html`]: "main.html",
  },
  lineBreakNormalization: true,
  // logLevel: "debug",
})

{
  const actual = buildMappings
  const expected = {
    [`${testDirectoryRelativeUrl}main.css`]: assert.any(String),
    [`${testDirectoryRelativeUrl}main.html`]: "main.html",
  }
  assert({ actual, expected })
}

// ensure link.href is correct
{
  const buildDirectoryUrl = resolveUrl(
    buildDirectoryRelativeUrl,
    jsenvCoreDirectoryUrl,
  )
  const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
  const htmlString = await readFile(htmlBuildUrl)
  const linkPreload = findNode(
    htmlString,
    (node) =>
      node.nodeName === "link" &&
      Boolean(getHtmlNodeAttributeByName(node, "crossorigin")),
  )
  const href = getHtmlNodeAttributeByName(linkPreload, "href").value

  const actual = href
  const expected = "https://fonts.googleapis.com/css2?family=Roboto"
  assert({ actual, expected })
}
