import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { execute, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_EXECUTE.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.js`

const { status, namespace } = await execute({
  ...EXECUTE_TEST_PARAMS,
  launchLogLevel: "info",
  jsenvDirectoryRelativeUrl,
  runtime: nodeRuntime,
  // runtimeParams: {
  //   debugPort: 40001,
  // },
  fileRelativeUrl,
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
