import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { execute, launchNode } from "@jsenv/core"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}alive-after-execution.js`

// node child process outlives execution if something keeps it alive
// and stopAfterExecute is false (default value)
{
  let nodeRuntimeHooks
  {
    const actual = await execute({
      ...EXECUTE_TEST_PARAMS,
      // executionLogLevel: "debug",
      jsenvDirectoryRelativeUrl,
      launch: async (options) => {
        nodeRuntimeHooks = await launchNode({ ...options, debugPort: 40001 })
        return nodeRuntimeHooks
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
    // to ensure the child process is still alive let's wait enought
    // and check for disconnected promise, disconnected must still be pending
    const actual = await Promise.race([
      nodeRuntimeHooks.disconnected,
      new Promise((resolve) => {
        setTimeout(() => resolve("timeout"), 2000)
      }),
    ])
    const expected = "timeout"
    assert({ actual, expected })
  }
  // now kill it properly
  await nodeRuntimeHooks.stop()
}

// now if we redo the experiment with stopAfterExecute child process should be killed
{
  let nodeRuntimeHooks
  {
    const actual = await execute({
      ...EXECUTE_TEST_PARAMS,
      // executionLogLevel: "debug",
      jsenvDirectoryRelativeUrl,
      launch: async (options) => {
        nodeRuntimeHooks = await launchNode({ ...options, debugPort: 40001 })
        return nodeRuntimeHooks
      },
      fileRelativeUrl,
      stopAfterExecute: true,
      gracefulStopAllocatedMs: 100,
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
        setTimeout(() => resolve("timeout"), 2000)
      }),
    ])
    const expected = "disconnected"
    assert({ actual, expected })
  }
}
