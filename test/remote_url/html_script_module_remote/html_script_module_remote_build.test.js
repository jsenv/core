import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToFileSystemPath,
  urlToRelativeUrl,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { browserImportEsModuleBuild } from "@jsenv/core/test/browserImportEsModuleBuild.js"
import { browserImportSystemJsBuild } from "@jsenv/core/test/browserImportSystemJsBuild.js"

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
    const jsFileRelativeUrl = preserve
      ? "http://127.0.0.1:9999/file.js"
      : `./${buildMappings[`http://127.0.0.1:9999/file.js`]}`
    const browserImport =
      format === "systemjs"
        ? browserImportSystemJsBuild
        : browserImportEsModuleBuild
    const { namespace, serverOrigin } = await browserImport({
      projectDirectoryUrl: jsenvCoreDirectoryUrl,
      testDirectoryRelativeUrl,
      htmlFileRelativeUrl: `./dist/${format}/main.html`,
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

  // systemjs + remote fetched during build
  const { importMetaUrl, serverOrigin, jsFileRelativeUrl } =
    await getImportMetaUrl({
      format: "systemjs",
      preserve: false,
    })
  const actual = {
    importMetaUrl,
  }
  const expected = {
    importMetaUrl: `${serverOrigin}/dist/systemjs/${jsFileRelativeUrl.slice(
      2,
    )}`,
  }
  assert({ actual, expected })

  // invalid integrity
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
--- response text ---
{
  "code": "EINTEGRITY",
  "message": "Integrity validation failed for ressource \\"http://127.0.0.1:9999/file.js\\". The integrity found for this ressource is \\"sha256-em3IiVT86dm2XSXRvIEfZ3vLW1qG2k/MgUvBCcX3bGs=\\""
}
--- url ---
http://127.0.0.1:9999/file.js
--- url trace ---
${urlToFileSystemPath(
  new URL("./main_integrity_invalid.html", import.meta.url),
)}`,
    }
    assert({ actual, expected })
  }
} finally {
  server.stop()
}
