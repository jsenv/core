import { takeDirectorySnapshot } from "@jsenv/snapshot";

import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";
import { takeCoverageSnapshots } from "../take_coverage_snapshots.js";

const testPlanResult = await executeTestPlan({
  logs: {
    level: "error",
  },
  rootDirectoryUrl: new URL("./", import.meta.url),
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
  coverage: {
    include: {
      "main.js": true,
    },
    coverageAndExecutionAllowed: true,
  },
  githubCheck: false,
});
const snapshotDirectoryUrl = new URL(`./output/snapshots/`, import.meta.url);
const directorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
await takeCoverageSnapshots(testPlanResult, {
  testOutputDirectoryUrl: new URL("./output/", import.meta.url),
  fileRelativeUrls: ["main.js"],
});
directorySnapshot.compare();
