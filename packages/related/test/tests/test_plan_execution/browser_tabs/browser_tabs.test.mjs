/*
 * The goal is to ensure test plan execution in browser tabs works without errors
 */

import { takeFileSnapshot } from "@jsenv/snapshot";
import { startDevServer } from "@jsenv/core";

import { executeTestPlan, chromium, reportAsJson } from "@jsenv/test";

const testResultJsonFileUrl = new URL(
  "./snapshots/test_result.json",
  import.meta.url,
);
const testResultJsonSnapshot = takeFileSnapshot(testResultJsonFileUrl);
const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
});
const result = await executeTestPlan({
  logs: {
    level: "warn",
  },
  rootDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./client/*.html": {
      a: {
        runtime: chromium(),
      },
      b: {
        runtime: chromium(),
      },
    },
  },
  webServer: {
    origin: devServer.origin,
    rootDirectoryUrl: new URL("./client/", import.meta.url),
  },
  githubCheck: false,
});
reportAsJson(result, testResultJsonFileUrl, {
  mockFluctuatingValues: true,
});
testResultJsonSnapshot.compare();
