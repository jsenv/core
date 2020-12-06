import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl, resolveUrl, readFile } from "@jsenv/util"
import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { browserImportSystemJsBuild } from "../browserImportSystemJsBuild.js"
import {
  GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
} from "../TEST_PARAMS.js"

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
  // logLevel: "info",
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

// importmap content
{
  const importmapBuildRelativeUrl = getBuildRelativeUrl("import-map.importmap")
  const fileBuildRelativeUrl = getBuildRelativeUrl("file.js")
  const fooBuildRelativeUrl = getBuildRelativeUrl("foo.js")
  const importmapBuildUrl = resolveUrl(importmapBuildRelativeUrl, buildDirectoryUrl)
  const importmapString = await readFile(importmapBuildUrl)
  const importmap = JSON.parse(importmapString)
  const actual = importmap
  const expected = {
    imports: {
      // the original importmap remapping are still there (but an updated version)
      "foo": `./${fooBuildRelativeUrl}`,
      // the importmap for foo is available
      "./file.js": `./${fileBuildRelativeUrl}`,
      "./foo.js": `./${fooBuildRelativeUrl}`,
      // and nothing more because js is referencing only an other js
    },
  }
  assert({ actual, expected })
}

// assert asset url is correct for javascript (remapped + hashed)
{
  const mainRelativeUrl = getBuildRelativeUrl("file.js")
  const { namespace } = await browserImportSystemJsBuild({
    ...IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    mainRelativeUrl: `./${mainRelativeUrl}`,
    // debug: true,
  })
  const actual = namespace
  const expected = {
    value: 42,
  }
  assert({ actual, expected })
}
