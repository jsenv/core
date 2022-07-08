import { assert } from "@jsenv/assert"

import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/core"

const test = async (params) => {
  const { namespace, performance } = await execute({
    // logLevel: "debug",
    rootDirectoryUrl: new URL("./node_client/", import.meta.url),
    fileRelativeUrl: `./main.js`,
    mirrorConsole: false,
    collectPerformance: true,
    keepRunning: true, // node will naturally exit
    ...params,
  })
  const actual = {
    namespace,
    performance,
  }
  const expected = {
    namespace: { answer: 42 },
    performance: {
      nodeTiming: actual.performance.nodeTiming,
      timeOrigin: actual.performance.timeOrigin,
      eventLoopUtilization: actual.performance.eventLoopUtilization,
      measures: {
        "a to b": assert.any(Number),
      },
    },
  }
  assert({ actual, expected })
}

// nodeChildProcess
await test({
  runtime: nodeChildProcess,
})

// nodeWorkerThread
await test({
  runtime: nodeWorkerThread,
})
