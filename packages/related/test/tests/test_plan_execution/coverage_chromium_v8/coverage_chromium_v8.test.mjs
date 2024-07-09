import { startDevServer } from "@jsenv/core";
import { takeDirectorySnapshot } from "@jsenv/snapshot";

import { executeTestPlan, chromium } from "@jsenv/test";
import { takeCoverageSnapshots } from "../take_coverage_snapshots.js";

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
  testPlan: {
    "./client/tests/main.test.html": {
      chrome: {
        runtime: chromium(),
        collectConsole: false,
      },
    },
  },
  // keepRunning: true,
  coverage: {
    include: {
      "./client/file.js": true,
    },
  },
  githubCheck: false,
});

const snapshotDirectoryUrl = new URL(`./output/snapshots/`, import.meta.url);
const directorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
await takeCoverageSnapshots(testPlanResult, {
  testOutputDirectoryUrl: new URL("./output/", import.meta.url),
  fileRelativeUrls: ["file.js"],
});
directorySnapshot.compare();
