import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { browserImportEsModuleBuild } from "@jsenv/core/test/browserImportEsModuleBuild.js"

const { server } = await import("./script/serve.js")
try {
  const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
  const testDirectoryRelativeUrl = urlToRelativeUrl(
    testDirectoryUrl,
    jsenvCoreDirectoryUrl,
  )
  const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
  const entryPoints = {
    [`./${testDirectoryRelativeUrl}main.html`]: "main.html",
  }
  const test = async (params) => {
    const build = await buildProject({
      ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
      // logLevel: "debug",
      jsenvDirectoryRelativeUrl,
      entryPoints,
      ...params,
    })
    return build
  }

  const { buildMappings } = await test({
    format: "esmodule",
    buildDirectoryRelativeUrl: `${testDirectoryRelativeUrl}dist/esmodule/`,
    externalUrlPatterns: {
      "http://localhost:9999/": true,
    },
  })
  const jsBuildRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}main.js`]
  const { namespace } = await browserImportEsModuleBuild({
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    testDirectoryRelativeUrl,
    jsFileRelativeUrl: `./${jsBuildRelativeUrl}`,
    // debug: true,
  })
  const actual = {
    namespace,
  }
  const expected = {
    namespace: {
      url: `${server.origin}/constants.js?foo=bar`,
    },
  }
  assert({ actual, expected })
} finally {
  server.stop()
}
