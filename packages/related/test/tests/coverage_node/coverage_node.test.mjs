import { assert } from "@jsenv/assert";

import {
  executeTestPlan,
  nodeChildProcess,
  nodeWorkerThread,
} from "@jsenv/test";

const test = async (params) => {
  const { coverage } = await executeTestPlan({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./", import.meta.url),
    testPlan: {
      "./node_client/main.js": {
        node: {
          collectConsole: false,
          ...params,
        },
      },
    },
    // keepRunning: true,
    coverageEnabled: true,
    coverageConfig: {
      "./node_client/file.js": true,
    },
    coverageMethodForNodeJs: "Profiler",
    coverageIncludeMissing: false,
    coverageReportTextLog: false,
    coverageReportHtml: false,
    githubCheckEnabled: false,
  });
  const actual = coverage;
  const expected = {
    "./node_client/file.js": {
      ...actual["./node_client/file.js"],
      path: "./node_client/file.js",
      s: {
        0: 1,
        1: 1,
        2: 0,
        3: 1,
        4: 1,
        5: 1,
        6: 0,
        7: 0,
      },
    },
  };
  assert({ actual, expected });
};

await test({
  runtime: nodeChildProcess(),
});
await test({
  runtime: nodeWorkerThread(),
});
