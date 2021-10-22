import { createCancellationSource } from "@jsenv/cancellation"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { execute, chromiumRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
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
const { cancel, token: cancellationToken } = createCancellationSource()

let errorCallbackArg
const actual = await execute({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  launchAndExecuteLogLevel: "off",
  cancellationToken,
  runtime: chromiumRuntime,
  runtimeParams: {
    ...LAUNCH_TEST_PARAMS,
  },
  fileRelativeUrl,
  stopAfterExecute: false,
  runtimeErrorAfterExecutionCallback: (argValue) => {
    errorCallbackArg = argValue
    cancel("error") // kill chromium browser to let process end
  },
})

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
