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
    [`./${testDirectoryRelativeUrl}file.js`]: "file.js",
  },
  customCompilers: {
    "**/file_umd.js": commonJsToJsModule,
  },
})
// eslint-disable-next-line import/no-unresolved
const namespace = await import("./dist/esmodule/file.js")
const actual = { ...namespace }
const exportDefault = { answer: 42 }
Object.defineProperty(exportDefault, "__esModule", {
  value: true,
})
const expected = {
  namedExports: Object.freeze(
    assert.asObjectWithoutPrototype({
      answer: 42,
      default: exportDefault,
    }),
  ),
}
assert({ actual, expected })
