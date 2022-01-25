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
const namespace = await import("./dist/esmodule/main.js")
const asObjectWithoutPrototype = (object) => {
  const objectWithoutPrototype = Object.create(null)
  Object.assign(objectWithoutPrototype, object)
  return objectWithoutPrototype
}
const actual = { ...namespace }
const exportDefault = { "a": 42, ")": "ooops, this is an invalid identifier" }
const expected = {
  all: Object.freeze(
    asObjectWithoutPrototype({
      __moduleExports: exportDefault,
      a: 42,
      default: exportDefault,
    }),
  ),
}
assert({ actual, expected })
