import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl, resolveUrl, readFile } from "@jsenv/util"
import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { parseCssUrls } from "@jsenv/core/src/internal/building/css/parseCssUrls.js"
import {
  GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { browserImportSystemJsBuild } from "@jsenv/core/test/browserImportSystemJsBuild.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `${testDirectoryname}.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
}

const { buildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  // minify: true,
})
const getBuildRelativeUrl = (urlRelativeToTestDirectory) => {
  const relativeUrl = `${testDirectoryRelativeUrl}${urlRelativeToTestDirectory}`
  const buildRelativeUrl = buildMappings[relativeUrl]
  return buildRelativeUrl
}

const buildDirectoryUrl = resolveUrl(buildDirectoryRelativeUrl, jsenvCoreDirectoryUrl)
const jsBuildRelativeUrl = getBuildRelativeUrl("file.js")
const imgRemapBuildRelativeUrl = getBuildRelativeUrl("img-remap.png")
const imgBuildRelativeUrl = getBuildRelativeUrl("img.png")

// check importmap content
{
  const importmapBuildRelativeUrl = getBuildRelativeUrl("import-map.importmap")
  const importmapBuildUrl = resolveUrl(importmapBuildRelativeUrl, buildDirectoryUrl)
  const importmapString = await readFile(importmapBuildUrl)
  const importmap = JSON.parse(importmapString)
  const actual = importmap
  const expected = {
    imports: {
      // the original importmap remapping are still there
      // ideally it should target `./${imgRemapBuildRelativeUrl}` but for now it's not supported
      "./img.png": "./img-remap.png",
      "./assets/img.png": `./${imgBuildRelativeUrl}`,
      // the importmap for img-remap is available
      "./assets/img-remap.png": `./${imgRemapBuildRelativeUrl}`,
      "./file.js": `./${jsBuildRelativeUrl}`,
      // and nothing more because js is referencing only img-remap
    },
  }
  assert({ actual, expected })
}

// assert asset url is correct for css (hashed)
{
  const cssBuildRelativeUrl = getBuildRelativeUrl("style.css")
  const cssBuildUrl = resolveUrl(cssBuildRelativeUrl, buildDirectoryUrl)
  const imgBuildUrl = resolveUrl(imgBuildRelativeUrl, buildDirectoryUrl)
  const cssString = await readFile(cssBuildUrl)
  const cssUrls = await parseCssUrls(cssString, cssBuildUrl)
  const actual = cssUrls.urlDeclarations[0].specifier
  const expected = urlToRelativeUrl(imgBuildUrl, cssBuildUrl)
  assert({ actual, expected })
}

// assert asset url is correct for javascript (remapped + hashed)
{
  const mainRelativeUrl = getBuildRelativeUrl("file.js")
  const { namespace, serverOrigin } = await browserImportSystemJsBuild({
    ...IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    mainRelativeUrl: `./${mainRelativeUrl}`,
    // debug: true,
  })
  const actual = {
    urlFromStaticImport: namespace.urlFromStaticImport,
    urlFromDynamicImport: namespace.urlFromDynamicImport,
    urlFromImportMetaNotation: namespace.urlFromImportMetaNotation,
  }
  const expected = {
    urlFromStaticImport: resolveUrl(`dist/systemjs/${imgRemapBuildRelativeUrl}`, serverOrigin),
    urlFromDynamicImport: {
      default: resolveUrl(`dist/systemjs/${imgRemapBuildRelativeUrl}`, serverOrigin),
    },
    // We MUST NOT introduce a build only importmap awareness
    // otherwise it would introduce a difference between dev/after build.
    // As new URL(relativeUrl, import.meta.url) is a standard url resolution where
    // importmap does not apply. Dev does not change that, and files after build neither.
    // That being said. when output format is systemjs we still use importmap to avoid
    // having to invalidate the js because an asset changes.
    // TODO: retest this whole stuff with an output format of esmodule
    urlFromImportMetaNotation: resolveUrl(`dist/systemjs/${imgBuildRelativeUrl}`, serverOrigin),
  }
  assert({ actual, expected })
}
