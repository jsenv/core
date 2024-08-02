import {
  executeTestPlan,
  nodeWorkerThread,
  reportCoverageAsHtml,
} from "@jsenv/test";
import { snapshotTestPlanSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";
import { takeCoverageSnapshots } from "../take_coverage_snapshots.js";

const run = async ({ testPlan }) => {
  const testPlanResult = await executeTestPlan({
    logs: {
      level: "error",
    },
    rootDirectoryUrl: new URL("./node_client/", import.meta.url),
    testPlan,
    coverage: {
      include: {
        "main.js": true,
      },
      coverageAndExecutionAllowed: true,
    },
    githubCheck: false,
  });
  reportCoverageAsHtml(
    testPlanResult,
    new URL("./.coverage/", import.meta.url),
  );
  await takeCoverageSnapshots(
    new URL("./.coverage/", import.meta.url),
    ["main.js"],
    {
      screenshotDirectoryUrl: new URL("./", import.meta.url),
    },
  );
};

await snapshotTestPlanSideEffects(import.meta.url, ({ test }) => {
  test("0_basic", async () => {
    await run({
      testPlan: {
        "main.js": {
          node: {
            runtime: nodeWorkerThread({
              gracefulStopAllocatedMs: 1_000,
              env: { AWAIT_FOREVER: true },
            }),
            allocatedMs: 3_000,
          },
        },
      },
    });
  });
});
