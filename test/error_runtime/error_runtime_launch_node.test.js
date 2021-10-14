import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { execute, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_NODE.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const filename = `error_runtime.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`

const result = await execute({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  launchAndExecuteLogLevel: "off",
  runtime: nodeRuntime,
  runtimeParams: {
    ...LAUNCH_TEST_PARAMS,
  },
  fileRelativeUrl,
  captureConsole: true,
  ignoreError: true,
})

const actual = {
  status: result.status,
  errorMessage: result.error.message,
  consoleCallsContainsString: result.consoleCalls.some(({ text }) =>
    text.includes("SPECIAL_STRING_UNLIKELY_TO_COLLIDE"),
  ),
}
const expected = {
  status: "errored",
  errorMessage: "SPECIAL_STRING_UNLIKELY_TO_COLLIDE",
  consoleCallsContainsString: false,
}
assert({ actual, expected })

{
  const stack = result.error.stack
  const expected = `Error: SPECIAL_STRING_UNLIKELY_TO_COLLIDE
    at triggerError (${testDirectoryUrl}trigger_error.js:2:9)
    at ${testDirectoryUrl}error_runtime.js:3:1`
  const actual = stack.slice(0, expected.length)
  assert({ actual, expected })
}
