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
const fileRelativeUrl = `${testDirectoryRelativeUrl}set_interval_forever.js`
const test = async (params) => {
  let nodeRuntimeHooks
  const result = await execute({
    ...EXECUTE_TEST_PARAMS,
    // launchAndExecuteLogLevel: "debug",
    jsenvDirectoryRelativeUrl,
    runtime: {
      ...nodeRuntime,
      launch: async (params) => {
        nodeRuntimeHooks = await nodeRuntime.launch({
          ...params,
          // debugPort: 40001,
        })
        return nodeRuntimeHooks
      },
    },
    fileRelativeUrl,
    ...params,
  })

  return {
    ...result,
    nodeRuntimeHooks,
  }
}

// node child process outlives execution if something keeps it alive
// and stopAfterExecute is false (default value)
{
  const { status, namespace, nodeRuntimeHooks } = await test({
    stopAfterExecute: false,
  })

  const actual = { status, namespace }
  const expected = {
    status: "completed",
    namespace: {},
  }
  assert({ actual, expected })

  {
    // to ensure the child process is still alive let's wait enought
    // and check for disconnected promise, disconnected must still be pending
    const actual = await Promise.race([
      new Promise((resolve) =>
        nodeRuntimeHooks.stoppedSignal.addCallback(() => resolve("stopped")),
      ),
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
  const { status, namespace, nodeRuntimeHooks } = await test({
    stopAfterExecute: true,
    gracefulStopAllocatedMs: 100,
  })

  const actual = { status, namespace }
  const expected = {
    status: "completed",
    namespace: {},
  }
  assert({ actual, expected })

  {
    const actual = await Promise.race([
      new Promise((resolve) => {
        if (nodeRuntimeHooks.stoppedSignal.emitted) resolve("stopped")
        nodeRuntimeHooks.stoppedSignal.addCallback(() => resolve("stopped"))
      }),
      new Promise((resolve) => {
        setTimeout(() => resolve("timeout"), 2000)
      }),
    ])
    const expected = "stopped"
    assert({ actual, expected })
  }
}
