/*
 * https://github.com/bcoe/c8/issues/116#issuecomment-503039423
 * https://github.com/SimenB/jest/blob/917efc3398577c205f33c1c2f9a1aeabfaad6f7d/packages/jest-coverage/src/index.ts
 */

import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";
import { takeCoverageSnapshots } from "../take_coverage_snapshots.js";

const testPlanResult = await executeTestPlan({
  logs: {
    level: "warn",
  },
  rootDirectoryUrl: new URL("./", import.meta.url),
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
  // keepRunning: true,
  coverage: {
    include: {
      "./file.js": true,
    },
    methodForNodeJs: "Profiler",
  },
  githubCheck: false,
});
await takeCoverageSnapshots(
  testPlanResult,
  new URL(`./snapshots/`, import.meta.url),
  ["file.js"],
);
