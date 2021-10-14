import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { execute, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
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
const filename = `process-disconnect-late-launch-node.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`

let disconnectCallbackArg
const actual = await execute({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  runtime: nodeRuntime,
  runtimeParams: {
    ...LAUNCH_TEST_PARAMS,
  },
  fileRelativeUrl,
  runtimeDisconnectCallback: (argValue) => {
    disconnectCallbackArg = argValue
  },
})
const expected = {
  status: "completed",
  namespace: {
    output: {},
  },
}
assert({ actual, expected })

process.on("beforeExit", () => {
  const actual = disconnectCallbackArg
  const expected = { timing: "after-execution" }
  assert({ actual, expected })
})
