import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToFileSystemPath,
  urlToRelativeUrl,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { executeInBrowser } from "@jsenv/core/test/execute_in_browser.js"

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
  const getImportMetaUrl = async ({
    preserve = true,
    format = "esmodule",
    ...rest
  }) => {
    const { buildMappings } = await buildProject({
      ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
      format,
      // logLevel: "debug",
      jsenvDirectoryRelativeUrl,
      entryPoints,
      buildDirectoryRelativeUrl: `${testDirectoryRelativeUrl}dist/${format}/`,
      preservedUrls: {
        "http://127.0.0.1:9999/": preserve,
      },
      ...rest,
    })
    const jsBuildRelativeUrl = preserve
      ? "http://127.0.0.1:9999/file.js"
      : `./${buildMappings[`http://127.0.0.1:9999/file.js`]}`
    if (format === "systemjs") {
      const { returnValue, serverOrigin } = await executeInBrowser({
        directoryUrl: new URL("./", import.meta.url),
        htmlFileRelativeUrl: `./dist/systemjs/main.html`,
        /* eslint-disable no-undef */
        pageFunction: async (jsBuildRelativeUrl) => {
          return window.System.import(jsBuildRelativeUrl)
        },
        /* eslint-enable no-undef */
        pageArguments: [jsBuildRelativeUrl],
      })
      return {
        importMetaUrl: returnValue.url,
        serverOrigin,
        jsBuildRelativeUrl,
      }
    }
    const { returnValue, serverOrigin } = await executeInBrowser({
      directoryUrl: new URL("./", import.meta.url),
      htmlFileRelativeUrl: `./dist/esmodule/main.html`,
      /* eslint-disable no-undef */
      pageFunction: async (jsBuildRelativeUrl) => {
        const namespace = await import(jsBuildRelativeUrl)
        return namespace
      },
      /* eslint-enable no-undef */
      pageArguments: [jsBuildRelativeUrl],
    })
    return {
      importMetaUrl: returnValue.url,
      serverOrigin,
      jsBuildRelativeUrl,
    }
  }

  // remote js preserved
  if (process.platform !== "win32") {
    // fails on windows (I think because of 127.0.0.1)
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
  if (process.platform !== "win32") {
    // fails on windows (I think because of 127.0.0.1)
    const { importMetaUrl, serverOrigin, jsBuildRelativeUrl } =
      await getImportMetaUrl({
        preserve: false,
      })
    const actual = {
      importMetaUrl,
    }
    const expected = {
      importMetaUrl: `${serverOrigin}/dist/esmodule/${jsBuildRelativeUrl.slice(
        2,
      )}`,
    }
    assert({ actual, expected })
  }

  // systemjs + remote fetched during build
  if (process.platform !== "win32") {
    // fails on windows (I think because of 127.0.0.1)
    const { importMetaUrl, serverOrigin, jsBuildRelativeUrl } =
      await getImportMetaUrl({
        format: "systemjs",
        preserve: false,
      })
    const actual = {
      importMetaUrl,
    }
    const expected = {
      importMetaUrl: `${serverOrigin}/dist/systemjs/${jsBuildRelativeUrl.slice(
        2,
      )}`,
    }
    assert({ actual, expected })
  }

  // invalid integrity
  if (process.platform !== "win32") {
    // fails on windows (I think because of 127.0.0.1)
    try {
      await getImportMetaUrl({
        preserve: false,
        entryPoints: {
          [`./${testDirectoryRelativeUrl}main_integrity_invalid.html`]:
            "main.html",
        },
      })
      throw new Error("should throw")
    } catch (e) {
      const actual = {
        errorMessage: e.message,
      }
      const expected = {
        errorMessage: `invalid response status on url
--- response status ---
502
--- url ---
http://127.0.0.1:9999/file.js
--- url trace ---
${urlToFileSystemPath(
  new URL("./main_integrity_invalid.html", import.meta.url),
)}
--- response text ---
{
  "code": "EINTEGRITY",
  "message": "Integrity validation failed for ressource \\"http://127.0.0.1:9999/file.js\\". The integrity found for this ressource is \\"sha256-em3IiVT86dm2XSXRvIEfZ3vLW1qG2k/MgUvBCcX3bGs=\\""
}`,
      }
      assert({ actual, expected })
    }
  }
} finally {
  server.stop()
}
