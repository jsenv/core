import {
  executeTestPlan,
  nodeChildProcess,
  nodeWorkerThread,
  reportCoverageAsHtml,
  reportCoverageAsJson,
} from "@jsenv/test";
import { snapshotTestPlanSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";
import { takeCoverageSnapshots } from "../take_coverage_snapshots.js";

await snapshotTestPlanSideEffects(import.meta.url, ({ test }) => {
  const run = async ({ runtime }) => {
    const testPlanResult = await executeTestPlan({
      logs: {
        level: "warn",
      },
      rootDirectoryUrl: new URL("./", import.meta.url),
      testPlan: {
        "./node_client/main.js": {
          node: {
            collectConsole: false,
            runtime,
          },
        },
      },
      coverage: {
        include: {
          "./node_client/file.js": true,
        },
        includeMissing: false,
        methodForNodeJs: "Profiler",
      },
      githubCheck: false,
    });
    reportCoverageAsJson(
      testPlanResult,
      new URL("./coverage.json", import.meta.url),
    );
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

  test("0_worker_thread", () =>
    run({
      runtime: nodeWorkerThread(),
    }));
  test("1_child_process", () =>
    run({
      runtime: nodeChildProcess(),
    }));
});
