import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, urlToBasename, readFile } from "@jsenv/util"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import {
  findNode,
  getHtmlNodeAttributeByName,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`

const { buildMappings } = await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${testDirectoryname}.html`]: "./main.html",
  },
  // logLevel: "debug",
})

// ensure link.href is correct
{
  const buildDirectoryUrl = resolveUrl(buildDirectoryRelativeUrl, jsenvCoreDirectoryUrl)
  const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
  const htmlString = await readFile(htmlBuildUrl)
  const linkPreload = findNode(htmlString, (node) => node.nodeName === "link")
  const href = getHtmlNodeAttributeByName(linkPreload, "href").value

  const actual = href
  const expected = buildMappings[`${testDirectoryRelativeUrl}src/main.css`]
  assert({ actual, expected })
}
