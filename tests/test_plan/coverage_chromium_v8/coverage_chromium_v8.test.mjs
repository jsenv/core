import { assert } from "@jsenv/assert"

import { executeTestPlan, chromium } from "@jsenv/core"

const { testPlanCoverage } = await executeTestPlan({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./main.html": {
      chrome: {
        runtime: chromium,
        runtimeParams: {
          // headful: true,
        },
        collectConsole: false,
      },
    },
  },
  // keepRunning: true,
  coverageEnabled: true,
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
    path: `./file.js`,
    s: {
      0: 1,
      1: 1,
      2: 1,
      3: 1,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
    },
  },
}
assert({ actual, expected })
