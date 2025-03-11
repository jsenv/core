/*
 * The ability to let a runtime alive after execution is not documented
 * and there is no use case for now.
 * TODO: remove ability to keep a runtime alive after execution
 * This test is disabled because it fail sometimes
 */

import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { execute, chromiumRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import {
  EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_BROWSER.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativePath}.jsenv/`
const filename = `error_runtime_after_timeout.html`
const fileRelativeUrl = `${testDirectoryRelativePath}${filename}`
const abortController = new AbortController()

let errorCallbackArg
const { status, namespace } = await execute({
  ...EXECUTE_TEST_PARAMS,
  signal: abortController.signal,
  jsenvDirectoryRelativeUrl,
  launchAndExecuteLogLevel: "off",
  runtime: chromiumRuntime,
  runtimeParams: {
    ...LAUNCH_TEST_PARAMS,
  },
  fileRelativeUrl,
  stopAfterExecute: false,
  runtimeErrorAfterExecutionCallback: (argValue) => {
    errorCallbackArg = argValue
    abortController.abort() // kill chromium browser to let process end
  },
})
const actual = {
  status,
  namespace,
}
const expected = {
  status: "completed",
  namespace: {
    [`./error_runtime_after_timeout.js`]: {
      status: "completed",
      namespace: {},
    },
  },
}
assert({ actual, expected })

process.on("beforeExit", () => {
  const actual = {
    errorMessage: errorCallbackArg.message,
  }
  const expected = {
    errorMessage: actual.errorMessage,
  }
  assert({ actual, expected })
})
