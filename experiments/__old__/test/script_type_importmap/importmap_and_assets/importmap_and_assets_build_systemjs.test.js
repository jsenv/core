import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { parseCssUrls } from "@jsenv/core/src/internal/transform_css/parse_css_urls.js"
import { GENERATE_SYSTEMJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import {
  findHtmlNodeById,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"
import { executeInBrowser } from "@jsenv/core/test/execute_in_browser.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const { buildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}importmap_and_assets.html`]: "main.html",
  },
  // minify: true,
})
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const jsBuildRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}main.js`]
const cssBuildRelativeUrl =
  buildMappings[`${testDirectoryRelativeUrl}style.css`]

// check importmap content
{
  const htmlBuildFileUrl = resolveUrl("main.html", buildDirectoryUrl)
  const html = await readFile(htmlBuildFileUrl)
  const importmapHtmlNode = findHtmlNodeById(html, "importmap")
  const importmapTextNode = getHtmlNodeTextNode(importmapHtmlNode)
  const importmapString = importmapTextNode.value
  const importmap = JSON.parse(importmapString)
  const imgRemapBuildRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}img-remap.png`]

  const actual = importmap
  const expected = {
    imports: {
      // the importmap for img-remap is available
      "./assets/img-remap.png": `./${imgRemapBuildRelativeUrl}`,
      // and nothing more because js is referencing only img-remap
    },
  }
  assert({ actual, expected })
}

// assert asset url is correct for css (hashed)
{
  const imgBuildRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}img.png`]
  const cssBuildUrl = resolveUrl(cssBuildRelativeUrl, buildDirectoryUrl)
  const imgBuildUrl = resolveUrl(imgBuildRelativeUrl, buildDirectoryUrl)
  const cssString = await readFile(cssBuildUrl)
  const cssUrls = await parseCssUrls({ url: cssBuildUrl, content: cssString })

  const actual = cssUrls[0].specifier
  const expected = urlToRelativeUrl(imgBuildUrl, cssBuildUrl)
  assert({ actual, expected })
}

// assert asset url is correct for javascript (remapped + hashed)
{
  const imgRemapBuildRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}img-remap.png`]
  const { returnValue, serverOrigin } = await executeInBrowser({
    directoryUrl: new URL("./", import.meta.url),
    htmlFileRelativeUrl: "./dist/systemjs/main.html",
    /* eslint-disable no-undef */
    pageFunction: (jsBuildRelativeUrl) => {
      return window.System.import(jsBuildRelativeUrl)
    },
    /* eslint-enable no-undef */
    pageArguments: [`./${jsBuildRelativeUrl}`],
  })
  const actual = returnValue
  const expected = {
    imgUrlIsInstanceOfUrl: true,
    imgUrlString: resolveUrl(
      `dist/systemjs/${imgRemapBuildRelativeUrl}`,
      serverOrigin,
    ),
  }
  assert({ actual, expected })
}
