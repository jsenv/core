/*
 * https://github.com/bcoe/c8/issues/116#issuecomment-503039423
 * https://github.com/SimenB/jest/blob/917efc3398577c205f33c1c2f9a1aeabfaad6f7d/packages/jest-coverage/src/index.ts
 */

import {
  executeTestPlan,
  nodeWorkerThread,
  reportCoverageAsHtml,
} from "@jsenv/test";
import { snapshotTestPlanSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";
import { takeCoverageSnapshots } from "../take_coverage_snapshots.js";

await snapshotTestPlanSideEffects(import.meta.url, ({ test }) => {
  const run = async ({ testPlan }) => {
    const testPlanResult = await executeTestPlan({
      logs: {
        level: "warn",
      },
      rootDirectoryUrl: new URL("./node_client/", import.meta.url),
      testPlan,
      coverage: {
        include: {
          "./file.js": true,
        },
        methodForNodeJs: "Profiler",
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
        "./main.js": {
          node: {
            runtime: nodeWorkerThread({
              env: { FOO: true },
            }),
          },
          node2: {
            runtime: nodeWorkerThread(),
          },
        },
      },
    });
  });
});
