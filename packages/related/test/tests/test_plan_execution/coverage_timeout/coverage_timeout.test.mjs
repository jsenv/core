import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";
import { takeCoverageScreenshots } from "../take_coverage_screenshots.js";

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
await takeCoverageScreenshots(
  testPlanResult,
  new URL(`./screenshots/`, import.meta.url),
  ["main.js"],
);
