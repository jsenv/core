import {
  executeTestPlan,
  nodeChildProcess,
  nodeWorkerThread,
} from "@jsenv/test";
import { takeCoverageScreenshots } from "../take_coverage_screenshots.js";

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
  await takeCoverageScreenshots(
    testPlanResult,
    new URL(`./screenshots/${name}/`, import.meta.url),
    ["file.js"],
  );
};

await test("child_process", {
  runtime: nodeChildProcess(),
});
await test("worker_thread", {
  runtime: nodeWorkerThread(),
});
