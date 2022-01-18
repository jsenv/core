import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { executeInBrowser } from "@jsenv/core/test/execute_in_browser.js"

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
  entryPoints: {
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
  const { returnValue } = await executeInBrowser({
    directoryUrl: new URL("./", import.meta.url),
    htmlFileRelativeUrl: "./dist/esmodule/main.prod.html",
    /* eslint-disable no-undef */
    pageFunction: async (jsBuildRelativeUrl) => {
      const namespace = await import(jsBuildRelativeUrl)
      return namespace
    },
    /* eslint-enable no-undef */
    pageArguments: [jsBuildRelativeUrl],
  })
  const actual = {
    returnValue,
  }
  const expected = {
    returnValue: {
      data: 42,
    },
  }
  assert({ actual, expected })
}
