/*
 * The goal here is to ensure test plan can be used with an other server
 * than jsenv
 */

import { assert } from "@jsenv/assert";
import { startBuildServer } from "@jsenv/core";
import { executeTestPlan, chromium } from "@jsenv/test";

const buildServer = await startBuildServer({
  logLevel: "warn",
  buildDirectoryUrl: new URL("./project/public/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
});

const testPlanResult = await executeTestPlan({
  logs: {
    level: "warn",
  },
  rootDirectoryUrl: new URL("./project/", import.meta.url),
  testPlan: {
    "./public/**/*.test.html": {
      chromium: {
        runtime: chromium(),
      },
    },
  },
  // keepRunning: true,
  webServer: {
    origin: buildServer.origin,
    rootDirectoryUrl: new URL("./project/public/", import.meta.url),
  },
  githubCheck: false,
});

const chromiumResult = testPlanResult.results["public/main.test.html"].chromium;
const actual = {
  status: chromiumResult.status,
  errorMessage: chromiumResult.errors[0].message,
};
const expect = {
  status: "failed",
  errorMessage: "answer should be 42, got 43",
};
assert({ actual, expect });
