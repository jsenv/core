import { takeDirectorySnapshot } from "@jsenv/snapshot";

import {
  executeTestPlan,
  nodeChildProcess,
  nodeWorkerThread,
  reportAsJson,
} from "@jsenv/test";
import { takeCoverageSnapshots } from "../take_coverage_snapshots.js";

const test = async (name, params) => {
  const testPlanResult = await executeTestPlan({
    logs: {
      level: "warn",
    },
    rootDirectoryUrl: new URL("./", import.meta.url),
    testPlan: {
      "./node_client/main.js": {
        node: {
          collectConsole: false,
          ...params,
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
  const snapshotDirectoryUrl = new URL(`./snapshots/${name}/`, import.meta.url);
  const directorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  reportAsJson(
    testPlanResult,
    new URL("./test_plan_result.json", snapshotDirectoryUrl),
    {
      mockFluctuatingValues: true,
    },
  );
  await takeCoverageSnapshots(testPlanResult, snapshotDirectoryUrl, [
    "file.js",
  ]);
  directorySnapshot.compare();
};

await test("child_process", {
  runtime: nodeChildProcess(),
});
await test("worker_thread", {
  runtime: nodeWorkerThread(),
});
