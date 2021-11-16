import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  urlToBasename,
} from "@jsenv/filesystem"

import { chromiumRuntime, firefoxRuntime, execute } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_LAUNCH_NODE.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFilename = `${testDirectoryname}.html`
const importerRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${htmlFilename}`
const importMapFileRelativeUrl = `${testDirectoryRelativeUrl}import-map.importmap`

const test = async (params) => {
  const executionResult = await execute({
    ...EXECUTE_TEST_PARAMS,
    ignoreError: true,
    jsenvDirectoryRelativeUrl,
    fileRelativeUrl,
    stopAfterExecute: true,
    ...params,
  })
  const actual = {
    executionResultStatus: executionResult.status,
    executionResultErrorMessage: executionResult.error.message,
  }
  return actual
}

{
  const actual = await test({ runtime: firefoxRuntime })
  const expected = {
    executionResultStatus: "errored",
    executionResultErrorMessage: `Unmapped bare specifier.
--- specifier ---
foo
--- importer ---
${importerRelativeUrl}
--- how to fix ---
Add a mapping for "foo" into the importmap file at "${importMapFileRelativeUrl}"`,
  }
  assert({ actual, expected })
}

{
  const actual = await test({ runtime: chromiumRuntime })
  const expected = {
    executionResultStatus: "errored",
    executionResultErrorMessage: `Failed to resolve module specifier "foo". Relative references must start with either "/", "./", or "../".`,
  }
  assert({ actual, expected })
}
