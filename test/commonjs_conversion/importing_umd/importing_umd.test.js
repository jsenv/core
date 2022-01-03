import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject, commonJsToJavaScriptModule } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { nodeImportEsModuleBuild } from "@jsenv/core/test/nodeImportEsModuleBuild.js"

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
    "**/file_umd.js": commonJsToJavaScriptModule,
  },
})
const { namespace } = await nodeImportEsModuleBuild({
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  testDirectoryRelativeUrl,
  jsFileRelativeUrl: "dist/esmodule/file.js",
})

const actual = namespace
const expected = {
  namedExports: {
    __moduleExports: {
      answer: 42,
    },
    answer: 42,
    default: {
      answer: 42,
    },
  },
}
assert({ actual, expected })
