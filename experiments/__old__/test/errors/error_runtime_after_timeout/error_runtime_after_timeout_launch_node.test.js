import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { execute, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import {
  EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_NODE.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const filename = `error_runtime_after_timeout.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`

let errorCallbackArgValue
const { status, namespace } = await execute({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  launchAndExecuteLogLevel: "off",
  runtime: nodeRuntime,
  runtimeParams: {
    ...LAUNCH_TEST_PARAMS,
  },
  fileRelativeUrl,
  runtimeErrorAfterExecutionCallback: (value) => {
    errorCallbackArgValue = value
  },
  stopAfterExecute: false, // let runtime error occuring after timeout kill the process
})
const actual = {
  status,
  namespace,
}
const expected = {
  status: "completed",
  namespace: {},
}
assert({ actual, expected })

process.on("beforeExit", () => {
  const actual = errorCallbackArgValue
  const expected = Object.assign(new Error("child exited with 1"), {
    exitCode: 1,
  })

  assert({ actual, expected })
})
