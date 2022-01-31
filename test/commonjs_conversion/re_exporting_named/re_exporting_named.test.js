import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { buildProject, commonJsToJavaScriptModule } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}main.mjs`]: "main.js",
  },
  customCompilers: {
    "**/*.cjs": commonJsToJavaScriptModule,
  },
})
// eslint-disable-next-line import/no-unresolved
const namespace = await import("./dist/esmodule/main.js")
const actual = { ...namespace }
const expected = {
  all: Object.freeze(
    assert.asObjectWithoutPrototype({
      answer: 42,
      default: { answer: 42 },
    }),
  ),
  answer: 42,
}
assert({ actual, expected })
