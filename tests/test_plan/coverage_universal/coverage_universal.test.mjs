import { assert } from "@jsenv/assert"

import {
  executeTestPlan,
  nodeChildProcess,
  chromium,
  firefox,
  webkit,
} from "@jsenv/core"

const { testPlanCoverage } = await executeTestPlan({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./main.html": {
      chromium: {
        runtime: chromium,
      },
      firefox: {
        runtime: firefox,
      },
      webkit: {
        runtime: webkit,
      },
    },
    "./main.js": {
      node: {
        runtime: nodeChildProcess,
      },
      node2: {
        runtime: nodeChildProcess,
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
  coverageV8ConflictWarning: false,
})
const actual = testPlanCoverage
const expected = {
  "./file.js": {
    ...actual["./file.js"],
    path: "./file.js",
    s: {
      0: 3,
      1: 3,
      2: 1,
      3: 2,
      4: 2,
      5: 2,
      6: 0,
      7: 0,
    },
  },
}
assert({ actual, expected })
