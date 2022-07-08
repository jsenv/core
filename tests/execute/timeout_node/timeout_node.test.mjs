import { assert } from "@jsenv/assert"

import { execute, nodeChildProcess } from "@jsenv/core"

const startMs = Date.now()
const { status } = await execute({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./", import.meta.url),
  fileRelativeUrl: `./main.js`,
  runtime: nodeChildProcess,
  allocatedMs: 5000,
  mirrorConsole: false,
  collectConsole: true,
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
