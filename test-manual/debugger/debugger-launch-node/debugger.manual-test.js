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
const filename = `debugger.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`

const { status } = await execute({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  runtime: nodeRuntime,
  runtimeParams: {
    ...LAUNCH_TEST_PARAMS,
  },
  fileRelativeUrl,
  mirrorConsole: true,
})
const actual = {
  status,
}
const expected = {
  status: "completed",
}
assert({ actual, expected })
