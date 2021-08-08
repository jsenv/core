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
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  // minify: true,
})

const buildDirectoryUrl = resolveUrl(buildDirectoryRelativeUrl, jsenvCoreDirectoryUrl)
const manifestFileBuildRelativeUrl = "assets/manifest.webmanifest"

// ensure link.href is correct
{
  const htmlFileBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
  const htmlString = await readFile(htmlFileBuildUrl)
  const link = findNodeByTagName(htmlString, "link")
  const href = getHtmlNodeAttributeByName(link, "href").value

  const actual = href
  const expected = manifestFileBuildRelativeUrl
  assert({ actual, expected })
}

// ensure manifest build file is as expected
{
  const manifestFileBuildUrl = resolveUrl(manifestFileBuildRelativeUrl, buildDirectoryUrl)
  const manifestAfterBuild = await readFile(manifestFileBuildUrl, { as: "json" })

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
  const iconUrlForManifestBuild = resolveUrl("pwa.icon-574c1c76.png", manifestFileBuildUrl)
  await assertFilePresence(iconUrlForManifestBuild)
}
