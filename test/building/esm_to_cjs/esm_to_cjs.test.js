import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_COMMONJS_BUILD_TEST_PARAMS,
  REQUIRE_COMMONJS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_COMMONJS.js"
import { requireCommonJsBuild } from "@jsenv/core/test/requireCommonJsBuild.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs/`

const { buildMappings } = await buildProject({
  ...GENERATE_COMMONJS_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}main.mjs`]: "main.cjs",
  },
  assetManifestFile: true,
  assetManifestFileRelativeUrl: "manifest.json",
  // logLevel: "debug",
})

{
  const actual = buildMappings
  const expected = {
    [`${testDirectoryRelativeUrl}main.mjs`]: "main.cjs",
  }
  assert({ actual, expected })
}

{
  const { namespace: actual } = await requireCommonJsBuild({
    ...REQUIRE_COMMONJS_BUILD_TEST_PARAMS,
    buildDirectoryRelativeUrl,
    mainRelativeUrl: "./main.cjs",
  })
  const expected = { readFileType: "function" }
  assert({ actual, expected })
}
