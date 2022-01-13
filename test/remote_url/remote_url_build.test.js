/*
 * TODO:
 * - rename "externalImportUrlPatterns" -> "ignoredUrlPatterns"
 * - test that when url is specified in "ignoredUrlPatterns" the url is kept intact
 * (meaning the code generated after build still perform the http request)
 * - remote url should be fetched too in ressource_builder (again except if specified in "ignoredUrlPatterns")
 */

import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { browserImportEsModuleBuild } from "@jsenv/core/test/browserImportEsModuleBuild.js"
import { browserImportSystemJsBuild } from "@jsenv/core/test/browserImportSystemJsBuild.js"

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

  // esmodule
  {
    const { buildMappings } = await test({
      format: "esmodule",
      buildDirectoryRelativeUrl: `${testDirectoryRelativeUrl}dist/esmodule/`,
    })
    const jsBuildRelativeUrl =
      buildMappings[`${testDirectoryRelativeUrl}main.js`]
    const { namespace, serverOrigin } = await browserImportEsModuleBuild({
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
        url: `${serverOrigin}/dist/esmodule/${jsBuildRelativeUrl}`,
      },
    }
    assert({ actual, expected })
  }

  // systemjs
  {
    const { buildMappings } = await test({
      format: "systemjs",
      buildDirectoryRelativeUrl: `${testDirectoryRelativeUrl}dist/systemjs/`,
    })
    const jsBuildRelativeUrl =
      buildMappings[`${testDirectoryRelativeUrl}main.js`]
    const { namespace, serverOrigin } = await browserImportSystemJsBuild({
      projectDirectoryUrl: jsenvCoreDirectoryUrl,
      testDirectoryRelativeUrl,
      mainRelativeUrl: `./${jsBuildRelativeUrl}`,
      // debug: true,
    })
    const actual = {
      namespace,
    }
    const expected = {
      namespace: {
        url: `${serverOrigin}/dist/systemjs/${jsBuildRelativeUrl}`,
      },
    }
    assert({ actual, expected })
  }
} finally {
  server.stop()
}
