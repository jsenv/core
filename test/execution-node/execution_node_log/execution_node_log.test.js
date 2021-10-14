import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { execute, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_NODE.js"
import { removeAnnoyingLogs } from "@jsenv/core/test/removeAnnoyingLogs.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativePath}.jsenv/`
const filename = `execution_node_log.js`
const fileRelativeUrl = `${testDirectoryRelativePath}${filename}`

const { status, consoleCalls } = await execute({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  runtime: nodeRuntime,
  runtimeParams: {
    ...LAUNCH_TEST_PARAMS,
  },
  fileRelativeUrl,
  captureConsole: true,
})

const actual = status
const expected = "completed"
assert({ actual, expected })

if (process.platform !== "win32") {
  const actual = removeAnnoyingLogs(consoleCalls).reduce(
    (previous, { text }) => {
      return `${previous}${text}`
    },
    "",
  )
  const expected = `foo
bar
`
  assert({ actual, expected })
}
