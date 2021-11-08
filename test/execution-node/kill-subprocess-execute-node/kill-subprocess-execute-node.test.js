import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { execute, nodeRuntime } from "@jsenv/core"
import { EXECUTE_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_LAUNCH_NODE.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.js`

const { status, namespace } = await execute({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  runtime: nodeRuntime,
  runtimeParams: {
    debugPort: 40001,
  },
  fileRelativeUrl,
  stopAfterExecute: true,
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
