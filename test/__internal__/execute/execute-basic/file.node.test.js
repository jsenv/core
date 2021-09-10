import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { execute, launchNode } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_EXECUTE.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.js`

const actual = await execute({
  ...EXECUTE_TEST_PARAMS,
  launchLogLevel: "info",
  jsenvDirectoryRelativeUrl,
  launch: launchNode,
  // launchParams: {
  //   debugPort: 40001,
  // },
  fileRelativeUrl,
})
const expected = {
  status: "completed",
  namespace: {},
}
assert({ actual, expected })
