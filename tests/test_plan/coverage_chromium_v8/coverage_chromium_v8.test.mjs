import { assert } from "@jsenv/assert"

import { executeTestPlan, chromium, startDevServer } from "@jsenv/core"

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
})
const { testPlanCoverage } = await executeTestPlan({
  logLevel: "warn",
  testDirectoryUrl: new URL("./client/", import.meta.url),
  devServerOrigin: devServer.origin,
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
  coverageRootDirectoryUrl: new URL("./", import.meta.url),
  coverageConfig: {
    "./client/file.js": true,
  },
  coverageReportTextLog: false,
  coverageReportHtml: false,
})
const actual = testPlanCoverage
const expected = {
  "./client/file.js": {
    ...actual["./client/file.js"],
    path: `./client/file.js`,
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
