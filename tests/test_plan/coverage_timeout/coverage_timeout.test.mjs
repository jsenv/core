import { assert } from "@jsenv/assert"

import { executeTestPlan, nodeWorkerThread } from "@jsenv/core"

const testPlan = {
  "main.js": {
    node: {
      runtime: nodeWorkerThread,
      runtimeParams: {
        env: { AWAIT_FOREVER: true },
      },
      allocatedMs: 5000,
      gracefulStopAllocatedMs: 1000,
    },
  },
}
const { testPlanCoverage } = await executeTestPlan({
  logLevel: "error",
  rootDirectoryUrl: new URL("./", import.meta.url),
  testPlan,
  coverageEnabled: true,
  coverageAndExecutionAllowed: true,
  coverageReportTextLog: false,
  coverageConfig: {
    ["main.js"]: true,
  },
})
const actual = testPlanCoverage
const expected = {
  "./main.js": {
    ...actual["./main.js"],
    s: { 0: 0, 1: 0, 2: 0 },
  },
}
assert({ actual, expected })
