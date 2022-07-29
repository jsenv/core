import { assert } from "@jsenv/assert"

import {
  startDevServer,
  executeTestPlan,
  chromium,
  nodeChildProcess,
  nodeWorkerThread,
} from "@jsenv/core"

const devServer = await startDevServer({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
})
const { testPlanCoverage } = await executeTestPlan({
  logLevel: "off",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  serverOrigin: devServer.origin,
  testPlan: {
    "./main.html": {
      chromium: {
        runtime: chromium,
      },
    },
    "./main.js": {
      node_child_process: {
        runtime: nodeChildProcess,
      },
      node_worker_thread: {
        runtime: nodeWorkerThread,
      },
    },
  },
  coverageEnabled: true,
  coverageConfig: {
    "./js_syntax_error.js": true,
  },
  coverageReportTextLog: false,
  coverageReportHtmlDirectory: false,
})
const actual = testPlanCoverage
const expected = {
  "./js_syntax_error.js": {
    ...actual["./js_syntax_error.js"],
    s: {},
  },
}
assert({ actual, expected })
