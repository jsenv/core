/*
 * https://github.com/bcoe/c8/issues/116#issuecomment-503039423
 * https://github.com/SimenB/jest/blob/917efc3398577c205f33c1c2f9a1aeabfaad6f7d/packages/jest-coverage/src/index.ts
 */

import { assert } from "@jsenv/assert"

import { executeTestPlan, nodeWorkerThread } from "@jsenv/core"

const { testPlanCoverage } = await executeTestPlan({
  logLevel: "warn",
  testDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./main.js": {
      node: {
        runtime: nodeWorkerThread,
        runtimeParams: {
          env: {
            FOO: true,
          },
        },
      },
      node2: {
        runtime: nodeWorkerThread,
        runtimeParams: {},
      },
    },
  },
  // keepRunning: true,
  coverageEnabled: true,
  coverageConfig: {
    "./file.js": true,
  },
  coverageMethodForNodeJs: "Profiler",
  coverageReportTextLog: false,
  coverageReportHtml: false,
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
