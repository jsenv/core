import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  BROWSER_IMPORT_BUILD_TEST_PARAMS,
  NODE_IMPORT_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { browserImportEsModuleBuild } from "@jsenv/core/test/browserImportEsModuleBuild.js"
import { nodeImportEsModuleBuild } from "@jsenv/core/test/nodeImportEsModuleBuild.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`

{
  const { buildMappings } = await buildProject({
    ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPointMap: {
      [`./${testDirectoryRelativeUrl}dynamic_import.html`]: "./main.html",
    },
  })
  const mainJsFileBuildRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}dynamic_import.js`]

  const { namespace } = await browserImportEsModuleBuild({
    ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    jsFileRelativeUrl: `./${mainJsFileBuildRelativeUrl}`,
    // debug: true,
  })

  const actual = namespace
  const expected = { default: 42 }
  assert({ actual, expected })
}

// test importing with nodejs now
{
  const { buildMappings } = await buildProject({
    ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    // we build the HTML instead of the JS file on purpose
    // to test the warning about html + node
    entryPointMap: {
      [`./${testDirectoryRelativeUrl}dynamic_import.html`]: "./main.html",
    },
    runtimeSupport: {
      node: "14",
    },
  })
  const mainJsFileBuildRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}dynamic_import.js`]

  const { namespace } = await nodeImportEsModuleBuild({
    ...NODE_IMPORT_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    jsFileRelativeUrl: `./dist/esmodule/${mainJsFileBuildRelativeUrl}`,
  })

  const actual = namespace
  const expected = { default: 42 }
  assert({ actual, expected })
}
