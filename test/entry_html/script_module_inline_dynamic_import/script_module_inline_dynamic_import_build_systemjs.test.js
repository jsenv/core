import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  writeFile,
  resolveUrl,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { browserImportSystemJsBuild } from "@jsenv/core/test/browserImportSystemJsBuild.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `script_module_inline_dynamic_import.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
}
const { buildInlineFileContents } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  // minify: true,
})
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const inlineFileBuildRelativeUrl = "script_module_inline_dynamic_import.10.js"
const inlineFileBuildUrl = resolveUrl(
  inlineFileBuildRelativeUrl,
  buildDirectoryUrl,
)
await writeFile(
  inlineFileBuildUrl,
  buildInlineFileContents[inlineFileBuildRelativeUrl],
)

{
  const result = await browserImportSystemJsBuild({
    ...IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    mainRelativeUrl: `./${inlineFileBuildRelativeUrl}`,
    // debug: true,
  })
  const actual = result.namespace
  const expected = { value: 42 }
  assert({ actual, expected })
}
