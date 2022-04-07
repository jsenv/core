import { assert } from "@jsenv/assert"

import {
  executeTestPlan,
  nodeProcess,
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
        runtime: nodeProcess,
      },
      node2: {
        runtime: nodeProcess,
      },
    },
  },
  // keepRunning: true,
  coverage: true,
  coverageConfig: {
    "./file.js": true,
  },
  coverageTextLog: false,
  coverageHtmlDirectory: false,
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
