import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { parseCssUrls } from "@jsenv/core/src/internal/building/css/parseCssUrls.js"
import {
  GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  BROWSER_IMPORT_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import {
  findHtmlNodeById,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { browserImportEsModuleBuild } from "@jsenv/core/test/browserImportEsModuleBuild.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const { projectBuildMappings, buildManifest } = await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}importmap_and_assets.html`]: "main.html",
  },
  // minify: true,
  // logLevel: "debug",
})

{
  const actual = {
    buildManifest,
  }
  const expected = {
    buildManifest: {
      "assets/img.png": "assets/img_25e95a00.png",
      "assets/img-remap.png": "assets/img-remap_25e95a00.png",
      "assets/style.css": "assets/style_bb497274.css",
      "assets/style.css.map": "assets/style.css_1c41eaf0.map",
      "main.js": "main_9dd4a4eb.js",
      "main.js.map": "main_9dd4a4eb.js.map",
      "main.html": "main.html",
    },
  }
  assert({ actual, expected })
}

const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const mainBuildRelativeUrl =
  projectBuildMappings[`${testDirectoryRelativeUrl}main.js`]
const cssBuildRelativeUrl =
  projectBuildMappings[`${testDirectoryRelativeUrl}style.css`]

// check importmap content
{
  const imgRemapBuildRelativeUrl =
    projectBuildMappings[`${testDirectoryRelativeUrl}img-remap.png`]
  const htmlBuildFileUrl = resolveUrl("main.html", buildDirectoryUrl)
  const htmlBuildFileContent = await readFile(htmlBuildFileUrl)
  const importmapHtmlNode = findHtmlNodeById(htmlBuildFileContent, "importmap")
  const importmapTextNode = getHtmlNodeTextNode(importmapHtmlNode)
  const importmapString = importmapTextNode.value
  const importmap = JSON.parse(importmapString)

  const actual = importmap
  // importmap is the same because non js files are remapped
  const expected = {
    imports: {
      // the importmap for img-remap is available
      "./test/entry_html/importmap_and_assets/.jsenv/build/best/test/entry_html/importmap_and_assets/img-remap.png": `./${imgRemapBuildRelativeUrl}`,
      // and nothing more because js is referencing only img-remap
    },
  }
  assert({ actual, expected })
}

// assert asset url is correct for css (hashed)
{
  const imgBuildRelativeUrl =
    projectBuildMappings[`${testDirectoryRelativeUrl}img.png`]
  const cssBuildUrl = resolveUrl(cssBuildRelativeUrl, buildDirectoryUrl)
  const imgBuildUrl = resolveUrl(imgBuildRelativeUrl, buildDirectoryUrl)
  const cssString = await readFile(cssBuildUrl)
  const cssUrls = await parseCssUrls({ code: cssString, url: cssBuildUrl })

  const actual = cssUrls.urlDeclarations[0].specifier
  const expected = urlToRelativeUrl(imgBuildUrl, cssBuildUrl)
  assert({ actual, expected })
}

// assert asset url is correct for javascript (remapped + hashed)
{
  const imgRemapBuildRelativeUrl =
    projectBuildMappings[`${testDirectoryRelativeUrl}img-remap.png`]
  const { namespace, serverOrigin } = await browserImportEsModuleBuild({
    ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    jsFileRelativeUrl: `./${mainBuildRelativeUrl}`,
    // debug: true,
  })

  const actual = namespace
  const expected = {
    imgUrlIsInstanceOfUrl: true,
    imgUrlString: resolveUrl(
      `dist/esmodule/${imgRemapBuildRelativeUrl}`,
      serverOrigin,
    ),
  }
  assert({ actual, expected })
}
