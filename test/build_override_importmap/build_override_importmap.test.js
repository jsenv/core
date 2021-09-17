import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  urlToBasename,
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
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${testDirectoryname}.html`]: "./main.html",
}

const { buildMappings } = await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  urlMappings: {
    [`./${testDirectoryRelativeUrl}dev.importmap`]: `./${testDirectoryRelativeUrl}prod.importmap`,
  },
  // minify: true,
  // logLevel: "debug",
})

{
  const actual = buildMappings
  const expected = {
    [`${testDirectoryRelativeUrl}${testDirectoryname}.html`]: "main.html",
    [`${testDirectoryRelativeUrl}dev.importmap`]: "prod-4caf283d.importmap",
    [`${testDirectoryRelativeUrl}main.js`]: "main-019ca92a.js",
  }
  assert({ actual, expected })
}

{
  const { namespace } = await browserImportEsModuleBuild({
    ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    jsFileRelativeUrl: `./${
      buildMappings[`${testDirectoryRelativeUrl}main.js`]
    }`,
    // debug: true,
  })
  const actual = namespace
  const expected = {
    env: "prod",
  }
  assert({ actual, expected })
}
