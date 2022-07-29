import { assert } from "@jsenv/assert"

import {
  startDevServer,
  executeTestPlan,
  nodeWorkerThread,
  chromium,
  firefox,
  webkit,
} from "@jsenv/core"

const devServer = await startDevServer({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./", import.meta.url),
  keepProcessAlive: false,
  port: 0,
})
const { testPlanCoverage } = await executeTestPlan({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./", import.meta.url),
  devServerOrigin: devServer.origin,
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
        runtime: nodeWorkerThread,
      },
      node2: {
        runtime: nodeWorkerThread,
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
