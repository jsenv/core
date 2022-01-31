import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { executeInBrowser } from "@jsenv/core/test/execute_in_browser.js"

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
    entryPoints: {
      [`./${testDirectoryRelativeUrl}dynamic_import.html`]: "main.html",
    },
  })
  const jsBuildRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}dynamic_import.js`]
  const { returnValue } = await executeInBrowser({
    directoryUrl: new URL("./", import.meta.url),
    htmlFileRelativeUrl: "./dist/esmodule/main.html",
    /* eslint-disable no-undef */
    pageFunction: async (jsBuildRelativeUrl) => {
      const namespace = await import(jsBuildRelativeUrl)
      return namespace
    },
    /* eslint-enable no-undef */
    pageArguments: [`./${jsBuildRelativeUrl}`],
  })
  const actual = returnValue
  const expected = { default: 42 }
  assert({ actual, expected })
}

// test importing with nodejs now
{
  const { buildMappings } = await buildProject({
    ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
    logLevel: "error",
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    // we build the HTML instead of the JS file on purpose
    // to test the warning about html + node
    entryPoints: {
      [`./${testDirectoryRelativeUrl}dynamic_import.html`]: "main.html",
    },
    runtimeSupport: {
      node: "14",
    },
  })
  const mainJsFileBuildRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}dynamic_import.js`]
  const namespace = await import(
    `./dist/esmodule/${mainJsFileBuildRelativeUrl}`
  )
  const actual = { ...namespace }
  const expected = { default: 42 }
  assert({ actual, expected })
}
