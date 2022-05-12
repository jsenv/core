import { assert } from "@jsenv/assert"

import { execute, nodeProcess } from "@jsenv/core"

const { performance } = await execute({
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  fileRelativeUrl: `./main.js`,
  // logLevel: "debug",
  runtime: nodeProcess,
  mirrorConsole: false,
  collectPerformance: true,
  keepRunning: true, // node will naturally exit
})
const actual = {
  performance,
}
const expected = {
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
