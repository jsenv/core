import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { execute, launchNode } from "@jsenv/core"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.js`

const actual = await execute({
  ...EXECUTE_TEST_PARAMS,
  launchLogLevel: "info",
  jsenvDirectoryRelativeUrl,
  launch: (options) => launchNode({ ...options, debugPort: 40001 }),
  fileRelativeUrl,
})
const expected = {
  status: "completed",
  namespace: {},
}
assert({ actual, expected })
