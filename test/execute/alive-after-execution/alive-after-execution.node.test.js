import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { execute, launchNode } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}alive-after-execution.js`

// node child process outlives execution if something keeps it alive
// and stopPlatformAfterExecute is false (default value)
{
  let nodePlatformHooks
  {
    const actual = await execute({
      ...EXECUTE_TEST_PARAMS,
      launchLogLevel: "info",
      jsenvDirectoryRelativeUrl,
      launch: async (options) => {
        nodePlatformHooks = await launchNode({ ...options, debugPort: 40001 })
        return nodePlatformHooks
      },
      fileRelativeUrl,
    })
    const expected = {
      status: "completed",
    }
    assert({ actual, expected })
  }
  {
    // to ensure the child process is still alive let's wait enought
    // and check for disconnected promise, disconnected must still be pending
    const actual = await Promise.race([
      nodePlatformHooks.disconnected,
      new Promise((resolve) => {
        setTimeout(() => resolve("timeout"), 2000)
      }),
    ])
    const expected = "timeout"
    assert({ actual, expected })
  }
  // now kill it properly
  await nodePlatformHooks.stop()
}

// now if we redo the experiment with stopPlatformAfterExecute child process should be killed
{
  let nodePlatformHooks
  {
    const actual = await execute({
      ...EXECUTE_TEST_PARAMS,
      launchLogLevel: "debug",
      executeLogLevel: "debug",
      jsenvDirectoryRelativeUrl,
      launch: async (options) => {
        nodePlatformHooks = await launchNode({ ...options, debugPort: 40001 })
        return nodePlatformHooks
      },
      fileRelativeUrl,
      stopPlatformAfterExecute: true,
      gracefulStopAllocatedMs: 100,
    })
    const expected = {
      status: "completed",
    }
    assert({ actual, expected })
  }
  {
    const actual = await Promise.race([
      nodePlatformHooks.disconnected.then(() => "disconnected"),
      new Promise((resolve) => {
        setTimeout(() => resolve("timeout"), 2000)
      }),
    ])
    const expected = "disconnected"
    assert({ actual, expected })
  }
}
