import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  BROWSER_IMPORT_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { browserImportEsModuleBuild } from "@jsenv/core/test/browserImportEsModuleBuild.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const mainFilename = `main.html`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const { buildMappings } = await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "main.prod.html",
  },
})

// check sourcemap content
{
  const sourcemapBuildRelativeUrl = `${
    buildMappings[`${testDirectoryRelativeUrl}data.js?import_type=json`]
  }.map`
  const sourcemapBuildUrl = resolveUrl(
    sourcemapBuildRelativeUrl,
    buildDirectoryUrl,
  )
  const { file, sources, sourcesContent } = await readFile(sourcemapBuildUrl, {
    as: "json",
  })

  const actual = {
    file,
    sources,
    sourcesContent,
  }
  const expected = {
    file: "data.js", // "data.json" becomes "data.js"
    sources: [
      // the source url is theoric because data.js file do not really exist
      "../../.jsenv/build/best/test/importing_json/json_with_dynamic_import_assertion/data.js?import_type=json",
    ],
    sourcesContent: [
      // the source content is the fake "data.js" exporting the json
      'export default JSON.parse("42")',
    ],
  }
  assert({ actual, expected })
}

{
  const jsBuildRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}main.js`]
  const { namespace } = await browserImportEsModuleBuild({
    ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    htmlFileRelativeUrl: "./dist/esmodule/main.prod.html",
    jsFileRelativeUrl: `./${jsBuildRelativeUrl}`,
  })

  const actual = {
    namespace,
  }
  const expected = {
    namespace: {
      data: 42,
    },
  }
  assert({ actual, expected })
}
