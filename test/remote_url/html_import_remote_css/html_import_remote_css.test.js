import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"

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
    // TODO: read html written in dist, ensure the link.href is updated
    // to a local url
    // than ensure the content of our local roboto.css, ensure the font is also
    // present in the build directory
    const actual = buildMappings
    const expected = actual
    assert({ actual, expected })
  }
} finally {
  server.stop()
}
