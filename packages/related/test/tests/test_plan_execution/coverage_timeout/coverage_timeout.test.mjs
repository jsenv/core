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
await takeCoverageSnapshots(
  testPlanResult,
  new URL(`./snapshots/`, import.meta.url),
  ["main.js"],
);
