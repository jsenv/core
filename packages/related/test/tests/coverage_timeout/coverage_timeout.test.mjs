import { assert } from "@jsenv/assert";

import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

const testPlan = {
  "main.js": {
    node: {
      runtime: nodeWorkerThread({
        gracefulStopAllocatedMs: 1000,
        env: { AWAIT_FOREVER: true },
      }),
      allocatedMs: 5000,
    },
  },
};
const { coverage } = await executeTestPlan({
  logLevel: "error",
  rootDirectoryUrl: new URL("./", import.meta.url),
  testPlan,
  coverageEnabled: true,
  coverageAndExecutionAllowed: true,
  coverageReportTextLog: false,
  coverageConfig: {
    "main.js": true,
  },
  githubCheckEnabled: false,
});
const actual = coverage;
const expected = {
  "./main.js": {
    ...actual["./main.js"],
    s: { 0: 0, 1: 0, 2: 0 },
  },
};
assert({ actual, expected });
