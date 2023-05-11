import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";

import {
  executeTestPlan,
  chromium,
  nodeChildProcess,
  nodeWorkerThread,
} from "@jsenv/test";

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
});
const { testPlanCoverage } = await executeTestPlan({
  logLevel: "off",
  rootDirectoryUrl: new URL("./", import.meta.url),
  webServer: {
    origin: devServer.origin,
    rootDirectoryUrl: new URL("./client/", import.meta.url),
  },
  testPlan: {
    "./client/main.html": {
      chromium: {
        runtime: chromium(),
      },
    },
    "./client/main.js": {
      node_child_process: {
        runtime: nodeChildProcess(),
      },
      node_worker_thread: {
        runtime: nodeWorkerThread(),
      },
    },
  },
  coverageEnabled: true,
  coverageConfig: {
    "./client/js_syntax_error.js": true,
  },
  coverageReportTextLog: false,
  coverageReportHtml: false,
});
const actual = testPlanCoverage;
const expected = {
  "./client/js_syntax_error.js": {
    ...actual["./client/js_syntax_error.js"],
    s: {},
  },
};
assert({ actual, expected });
