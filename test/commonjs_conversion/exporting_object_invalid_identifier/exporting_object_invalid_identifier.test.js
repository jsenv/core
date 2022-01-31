import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { buildProject, commonJsToJsModule } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
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
    "**/*.cjs": commonJsToJsModule,
  },
})
// eslint-disable-next-line import/no-unresolved
const namespace = await import("./dist/esmodule/main.js")
const asObjectWithoutPrototype = (object) => {
  const objectWithoutPrototype = Object.create(null)
  Object.assign(objectWithoutPrototype, object)
  return objectWithoutPrototype
}
const actual = { ...namespace }
const expected = {
  all: Object.freeze(
    asObjectWithoutPrototype({
      a: 42,
      default: { "a": 42, ")": "ooops, this is an invalid identifier" },
    }),
  ),
}
assert({ actual, expected })
