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

  // esmodule default (http url preserved)
  {
    const { buildMappings } = await buildProject({
      ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
      jsenvDirectoryRelativeUrl,
      entryPoints,
      format: "esmodule",
      buildDirectoryRelativeUrl: `${testDirectoryRelativeUrl}dist/esmodule/`,
    })
    const jsBuildRelativeUrl =
      buildMappings[`${testDirectoryRelativeUrl}main.js`]
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
  }

  // esmodule + http url not preserved
  {
    const { buildMappings } = await buildProject({
      ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
      jsenvDirectoryRelativeUrl,
      entryPoints,
      buildDirectoryRelativeUrl: `${testDirectoryRelativeUrl}dist/esmodule/`,
      format: "esmodule",
      preservedUrls: {
        "http://localhost:9999/": false,
      },
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

  // TODO: systemjs url preserved (this will fail because server returns esm not systemjs)

  // systemjs + http url not preserved
  {
    const { buildMappings } = await buildProject({
      ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
      jsenvDirectoryRelativeUrl,
      entryPoints,
      buildDirectoryRelativeUrl: `${testDirectoryRelativeUrl}dist/systemjs/`,
      format: "systemjs",
      preservedUrls: {
        "http://localhost:9999/": false,
      },
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
