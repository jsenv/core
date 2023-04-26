import { assert } from "@jsenv/assert"
import { startDevServer } from "@jsenv/core"

import {
  executeTestPlan,
  nodeWorkerThread,
  chromium,
  firefox,
  webkit,
} from "@jsenv/test"

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./", import.meta.url),
  keepProcessAlive: false,
  port: 0,
})
const { testPlanCoverage } = await executeTestPlan({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./", import.meta.url),
  webServer: {
    origin: devServer.origin,
  },
  testPlan: {
    "./client/main.test.html": {
      chromium: {
        runtime: chromium(),
      },
      firefox: {
        runtime: firefox(),
      },
      webkit: {
        runtime: webkit(),
      },
    },
    "./client/main.test.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
      node2: {
        runtime: nodeWorkerThread(),
      },
    },
  },
  // keepRunning: true,
  coverageEnabled: true,
  coverageConfig: {
    "./client/file.js": true,
  },
  coverageMethodForNodeJs: "Profiler",
  coverageReportTextLog: false,
  coverageReportHtml: false,
  coverageV8ConflictWarning: false,
})
const actual = testPlanCoverage
const expected = {
  "./client/file.js": {
    ...actual["./client/file.js"],
    path: "./client/file.js",
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
