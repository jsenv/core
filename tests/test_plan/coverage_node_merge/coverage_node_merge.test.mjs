/*
 * https://github.com/bcoe/c8/issues/116#issuecomment-503039423
 * https://github.com/SimenB/jest/blob/917efc3398577c205f33c1c2f9a1aeabfaad6f7d/packages/jest-coverage/src/index.ts
 */

import { assert } from "@jsenv/assert"

import { executeTestPlan, nodeProcess } from "@jsenv/core"

const { testPlanCoverage } = await executeTestPlan({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./main.js": {
      node: {
        runtime: nodeProcess,
        runtimeParams: {
          env: {
            FOO: true,
          },
        },
      },
      node2: {
        runtime: nodeProcess,
        runtimeParams: {},
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
    b: {
      0: [2],
      1: [1],
    },
    s: {
      0: 2,
      1: 1,
      2: 1,
      3: 1,
      4: 1,
    },
  },
}
assert({ actual, expected })
