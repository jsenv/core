import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { chromiumRuntime, firefoxRuntime, execute } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { EXECUTE_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_LAUNCH_NODE.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const importerRelativeUrl = `${testDirectoryRelativeUrl}bare_specifier_not_mapped.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}bare_specifier_not_mapped.html`
// const importMapFileRelativeUrl = `${testDirectoryRelativeUrl}test.importmap`

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
Add a mapping for "foo" into the importmap file at "${fileRelativeUrl}"`,
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
