import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { execute, launchNode } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}natural-exit.js`

let nodeRuntimeHooks
{
  const actual = await execute({
    ...EXECUTE_TEST_PARAMS,
    // launchLogLevel: "debug",
    // executeLogLevel: "debug",
    jsenvDirectoryRelativeUrl,
    launch: async (options) => {
      nodeRuntimeHooks = await launchNode({ ...options, debugPort: 40001 })
      return nodeRuntimeHooks
    },
    fileRelativeUrl,
  })
  const expected = {
    status: "completed",
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
