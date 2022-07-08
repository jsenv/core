import { assert } from "@jsenv/assert"

import { executeTestPlan, nodeChildProcess } from "@jsenv/core"

const { testPlanCoverage } = await executeTestPlan({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./main.js": {
      node: {
        runtime: nodeChildProcess,
        runtimeParams: {
          // headful: true,
        },
        collectConsole: false,
      },
    },
  },
  // keepRunning: true,
  coverage: true,
  coverageConfig: {
    "./file.js": true,
  },
  coverageReportTextLog: false,
  coverageReportHtmlDirectory: false,
})
const actual = testPlanCoverage
const expected = {
  "./file.js": {
    ...actual["./file.js"],
    path: "./file.js",
    s: {
      0: 1,
      1: 1,
      2: 0,
      3: 1,
      4: 1,
      5: 1,
      6: 0,
      7: 0,
    },
  },
}
assert({ actual, expected })
