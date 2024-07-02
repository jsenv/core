import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";

import {
  executeTestPlan,
  chromium,
  nodeChildProcess,
  nodeWorkerThread,
} from "@jsenv/test";

const devServer = await startDevServer({
  logLevel: "off",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
});
const { coverage } = await executeTestPlan({
  logs: {
    level: "off",
  },
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
  coverage: {
    include: {
      "./client/js_syntax_error.js": true,
    },
  },
  githubCheck: false,
});
const actual = coverage;
const expect = {
  "./client/js_syntax_error.js": {
    ...actual["./client/js_syntax_error.js"],
    s: {},
  },
};
assert({ actual, expect });
