/*
 * The goal is to ensure test plan execution in browser tabs works without errors
 */

import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";

import { executeTestPlan, chromium } from "@jsenv/test";

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
const actual = result;
const expected = {
  rootDirectoryUrl: new URL("./", import.meta.url).href,
  groups: {
    a: {
      count: 1,
      runtimeType: "browser",
      runtimeName: "chromium",
      runtimeVersion: assert.any(String),
    },
    b: {
      count: 1,
      runtimeType: "browser",
      runtimeName: "chromium",
      runtimeVersion: assert.any(String),
    },
  },
  counters: {
    planified: 2,
    remaining: 0,
    executing: 0,
    executed: 2,
    aborted: 0,
    cancelled: 0,
    timedout: 0,
    failed: 0,
    completed: 2,
  },
  aborted: false,
  failed: false,
  duration: assert.any(Number),
  coverage: null,
  results: {
    "client/main.html": {
      a: assert.any(Object),
      b: assert.any(Object),
    },
  },
};
assert({ actual, expected });
