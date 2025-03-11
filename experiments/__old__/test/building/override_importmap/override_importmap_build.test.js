import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { executeInBrowser } from "@jsenv/core/test/execute_in_browser.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const { buildMappings } = await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}override_importmap.html`]: "main.html",
  },
  urlMappings: {
    [`./${testDirectoryRelativeUrl}dev.importmap`]: `./${testDirectoryRelativeUrl}prod.importmap`,
  },
  // minify: true,
  // logLevel: "debug",
})

{
  const actual = buildMappings
  const expected = {
    // the importmap is not in buildMappings as it was inlined by the build
    [`${testDirectoryRelativeUrl}main.js`]: "main_ca955363.js",
    [`${testDirectoryRelativeUrl}override_importmap.html`]: "main.html",
  }
  assert({ actual, expected })
}

{
  const jsBuildRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}main.js`]
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
  const expected = {
    env: "prod",
  }
  assert({ actual, expected })
}
