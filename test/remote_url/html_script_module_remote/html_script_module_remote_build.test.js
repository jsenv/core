import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { browserImportEsModuleBuild } from "@jsenv/core/test/browserImportEsModuleBuild.js"

const { server } = await import("./server/serve.js")
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
  const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
  const getImportMetaUrl = async ({ preserve = true, ...rest }) => {
    const { buildMappings } = await buildProject({
      ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
      // logLevel: "debug",
      jsenvDirectoryRelativeUrl,
      entryPoints,
      buildDirectoryRelativeUrl,
      format: "esmodule",
      preservedUrls: {
        "http://127.0.0.1:9999/": preserve,
      },
      ...rest,
    })
    const jsFileRelativeUrl = preserve
      ? "http://127.0.0.1:9999/file.js"
      : `./${buildMappings[`http://127.0.0.1:9999/file.js`]}`
    const { namespace, serverOrigin } = await browserImportEsModuleBuild({
      projectDirectoryUrl: jsenvCoreDirectoryUrl,
      testDirectoryRelativeUrl,
      htmlFileRelativeUrl: "./dist/esmodule/main.html",
      jsFileRelativeUrl,
    })
    return {
      importMetaUrl: namespace.url,
      serverOrigin,
      jsFileRelativeUrl,
    }
  }

  // remote js preserved
  {
    const { importMetaUrl } = await getImportMetaUrl({
      preserve: true,
    })
    const actual = {
      importMetaUrl,
    }
    const expected = {
      importMetaUrl: "http://127.0.0.1:9999/file.js",
    }
    assert({ actual, expected })
  }

  // remote js fetched during build
  {
    const { importMetaUrl, serverOrigin, jsFileRelativeUrl } =
      await getImportMetaUrl({
        preserve: false,
      })
    const actual = {
      importMetaUrl,
    }
    const expected = {
      importMetaUrl: `${serverOrigin}/dist/esmodule/${jsFileRelativeUrl.slice(
        2,
      )}`,
    }
    assert({ actual, expected })
  }
} finally {
  server.stop()
}
