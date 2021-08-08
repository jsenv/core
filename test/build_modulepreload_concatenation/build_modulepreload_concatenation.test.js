import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, urlToBasename, readFile } from "@jsenv/util"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  BROWSER_IMPORT_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import {
  findNodeByTagName,
  getHtmlNodeAttributeByName,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { browserImportEsModuleBuild } from "@jsenv/core/test/browserImportEsModuleBuild.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const mainFilename = `${testDirectoryname}.html`

const { buildMappings } = await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
  },
  // logLevel: "debug",
})

const buildDirectoryUrl = resolveUrl(buildDirectoryRelativeUrl, jsenvCoreDirectoryUrl)
const getBuildRelativeUrl = (urlRelativeToTestDirectory) => {
  const relativeUrl = `${testDirectoryRelativeUrl}${urlRelativeToTestDirectory}`
  const buildRelativeUrl = buildMappings[relativeUrl]
  return buildRelativeUrl
}

const mainJsBuildRelativeUrl = getBuildRelativeUrl("main.js")
const fileJsBuildRelativeUrl = getBuildRelativeUrl("file.js")

// ensure link is updated and importing file works
{
  const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
  const htmlString = await readFile(htmlBuildUrl, { as: "string" })
  const preloadLinkNode = findNodeByTagName(htmlString, "link")
  const preloadLinkHref = getHtmlNodeAttributeByName(preloadLinkNode, "href").value

  const { namespace } = await browserImportEsModuleBuild({
    ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    jsFileRelativeUrl: `./${mainJsBuildRelativeUrl}`,
    // debug: true,
  })

  const actual = {
    preloadLinkHref,
    namespace,
  }
  const expected = {
    preloadLinkHref: fileJsBuildRelativeUrl,
    namespace: { value: 42 },
  }
  assert({ actual, expected })
}
