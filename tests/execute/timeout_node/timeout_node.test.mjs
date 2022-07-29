import { assert } from "@jsenv/assert"

import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/core"

const test = async (params) => {
  const startMs = Date.now()
  const { status } = await execute({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./", import.meta.url),
    fileRelativeUrl: `./main.js`,
    allocatedMs: 5000,
    mirrorConsole: false,
    collectConsole: true,
    ...params,
  })
  const endMs = Date.now()
  const duration = endMs - startMs
  const durationIsAroundAllocatedMs = duration > 3000 && duration < 10_000
  const actual = {
    status,
    durationIsAroundAllocatedMs,
  }
  const expected = {
    status: "timedout",
    durationIsAroundAllocatedMs: true,
  }
  assert({ actual, expected })
}

// nodeChildProcess
await test({ runtime: nodeChildProcess })
// nodeWorkerThread
await test({ runtime: nodeWorkerThread })
