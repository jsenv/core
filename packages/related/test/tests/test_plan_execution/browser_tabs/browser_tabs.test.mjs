/*
 * The goal is to ensure test plan execution in browser tabs works without errors
 */

import { startDevServer } from "@jsenv/core";
import { chromium, executeTestPlan, reportAsJson } from "@jsenv/test";
import { snapshotTestPlanSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";

await snapshotTestPlanSideEffects(import.meta.url, async ({ test }) => {
  const run = async ({ testPlan }) => {
    const devServer = await startDevServer({
      logLevel: "warn",
      sourceDirectoryUrl: import.meta.resolve("./client/"),
      keepProcessAlive: false,
      port: 0,
    });
    const result = await executeTestPlan({
      logs: {
        level: "warn",
      },
      rootDirectoryUrl: new URL("./", import.meta.url),
      testPlan,
      webServer: {
        origin: devServer.origin,
        rootDirectoryUrl: import.meta.resolve("./client/"),
      },
      githubCheck: false,
    });
    reportAsJson(result, new URL("./result.json", import.meta.url));
  };
  test("0_basic", () =>
    run({
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
    }));
});
