import { startDevServer } from "@jsenv/core";
import { chromium, executeTestPlan, reportCoverageAsHtml } from "@jsenv/test";
import { snapshotTestPlanSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";
import { takeCoverageSnapshots } from "../take_coverage_snapshots.js";

await snapshotTestPlanSideEffects(import.meta.url, ({ test }) => {
  const run = async ({ testPlan }) => {
    const devServer = await startDevServer({
      logLevel: "warn",
      sourceDirectoryUrl: new URL("./client/", import.meta.url),
      keepProcessAlive: false,
      port: 0,
    });
    const testPlanResult = await executeTestPlan({
      logs: {
        level: "warn",
      },
      rootDirectoryUrl: new URL("./", import.meta.url),
      webServer: {
        origin: devServer.origin,
      },
      testPlan,
      coverage: {
        include: {
          "./client/file.js": true,
        },
      },
    });
    reportCoverageAsHtml(
      testPlanResult,
      new URL("./.coverage/", import.meta.url),
    );
    await takeCoverageSnapshots(
      new URL("./.coverage/", import.meta.url),
      ["file.js"],
      {
        screenshotDirectoryUrl: new URL("./", import.meta.url),
      },
    );
  };

  test("0_basic", async () => {
    await run({
      testPlan: {
        "./client/tests/main.test.html": {
          chrome: {
            runtime: chromium(),
            collectConsole: false,
          },
        },
      },
    });
  });
});
