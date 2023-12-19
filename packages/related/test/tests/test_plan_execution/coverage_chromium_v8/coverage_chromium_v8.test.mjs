import { startDevServer } from "@jsenv/core";

import { executeTestPlan, chromium } from "@jsenv/test";
import { takeCoverageScreenshots } from "../take_coverage_screenshots.js";

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

await takeCoverageScreenshots(
  testPlanResult,
  new URL("./screenshots/", import.meta.url),
  ["file.js"],
);
