import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { launchAndExecute } from "@jsenv/core/src/internal/executing/launchAndExecute.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  LAUNCH_AND_EXECUTE_TEST_PARAMS,
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
const { origin: compileServerOrigin, outDirectoryRelativeUrl } =
  await startCompileServer({
    ...START_COMPILE_SERVER_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
  })

let errorCallbackArgValue
const actual = await launchAndExecute({
  ...LAUNCH_AND_EXECUTE_TEST_PARAMS,
  launchAndExecuteLogLevel: "off",
  runtime: nodeRuntime,
  runtimeParams: {
      ...LAUNCH_TEST_PARAMS,
      outDirectoryRelativeUrl,
      compileServerOrigin,
    }
  executeParams: {
    fileRelativeUrl,
  },
  runtimeErrorCallback: (value) => {
    errorCallbackArgValue = value
  },
})
const expected = {
  status: "completed",
  namespace: {},
}
assert({ actual, expected })

process.on("beforeExit", () => {
  const actual = errorCallbackArgValue
  const expected = {
    error: Object.assign(new Error("child exited with 1"), { exitCode: 1 }),
    timing: "after-execution",
  }
  assert({ actual, expected })
})
