import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { execute, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_NODE.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativePath}.jsenv/`
const filename = `process-stay-alive-launch-node.js`
const fileRelativeUrl = `${testDirectoryRelativePath}${filename}`

const { status, namespace } = await execute({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  fileRelativeUrl,
  runtime: nodeRuntime,
  runtimeParams: {
    ...LAUNCH_TEST_PARAMS,
  },
})
const actual = {
  status,
  namespace,
}
const expected = {
  status: "completed",
}
assert({ actual, expected })
