import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_LAUNCH_NODE.js"
import { launchChromium, execute } from "@jsenv/core"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFilename = `${testDirectoryname}.html`
const importerRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${htmlFilename}`
const importMapFileRelativeUrl = `${testDirectoryRelativeUrl}import-map.importmap`

const executionResult = await execute({
  ...EXECUTE_TEST_PARAMS,
  ignoreError: true,
  jsenvDirectoryRelativeUrl,
  fileRelativeUrl,
  launch: launchChromium,
  stopAfterExecute: true,
})
const actual = {
  executionResultStatus: executionResult.status,
  executionResultErrorMessage: executionResult.error.message,
}
const expected = {
  executionResultStatus: "errored",
  executionResultErrorMessage: `Unmapped bare specifier.
--- specifier ---
foo
--- importer ---
${importerRelativeUrl}
--- how to fix ---
Add a mapping for "foo" into the importmap file at ${importMapFileRelativeUrl}
--- suggestion ---
Generate importmap using https://github.com/jsenv/jsenv-node-module-import-map`,
}
assert({ actual, expected })
