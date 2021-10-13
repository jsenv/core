import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, urlToBasename } from "@jsenv/filesystem"

import { execute, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_EXECUTE.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.js`

let nodeRuntimeHooks
{
  const actual = await execute({
    ...EXECUTE_TEST_PARAMS,
    // executionLogLevel: "debug",
    jsenvDirectoryRelativeUrl,
    runtime: {
      ...nodeRuntime,
      launch: async (params) => {
        nodeRuntimeHooks = await nodeRuntime({ ...params, debugPort: 40001 })
        return nodeRuntimeHooks
      },
    },
    fileRelativeUrl,
  })
  const expected = {
    status: "completed",
    namespace: {},
  }
  assert({ actual, expected })
}
{
  const actual = await Promise.race([
    nodeRuntimeHooks.disconnected.then(() => "disconnected"),
    new Promise((resolve) => {
      setTimeout(() => resolve("timeout"), 5000)
    }),
  ])
  const expected = "disconnected"
  assert({ actual, expected })
}
