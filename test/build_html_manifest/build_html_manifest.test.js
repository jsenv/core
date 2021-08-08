import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
  assertFilePresence,
  urlToBasename,
} from "@jsenv/util"

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

await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  // if we put log level warn we'll see the warning saying
  // manifest.json extension is incorrect, let's avoid it with
  // "error" log level
  // logLevel: "error",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  // minify: true,
})

const buildDirectoryUrl = resolveUrl(buildDirectoryRelativeUrl, jsenvCoreDirectoryUrl)
const manifestBuildRelativeUrl = "assets/manifest.json"
const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
const htmlString = await readFile(htmlBuildUrl)
const link = findNodeByTagName(htmlString, "link")

// ensure link.href is correct
{
  const hrefAttribute = getHtmlNodeAttributeByName(link, "href")
  const actual = hrefAttribute.value
  const expected = manifestBuildRelativeUrl
  assert({ actual, expected })
}

// ensure manifest build file is as expected
{
  const manifestBuildUrl = resolveUrl(manifestBuildRelativeUrl, buildDirectoryUrl)
  const manifestAfterBuild = await readFile(manifestBuildUrl, { as: "json" })
  const actual = manifestAfterBuild.icons
  const expected = [
    {
      src: "pwa.icon-574c1c76.png",
      sizes: "192x192",
      type: "image/png",
    },
  ]
  assert({ actual, expected })

  // ensure manifest can find this file
  const iconUrlForManifestBuild = resolveUrl("pwa.icon-574c1c76.png", manifestBuildUrl)
  await assertFilePresence(iconUrlForManifestBuild)
}
