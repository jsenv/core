import { startDevServer } from "@jsenv/core";

import { executeTestPlan, chromium, firefox, webkit } from "@jsenv/test";
import { takeCoverageScreenshots } from "../take_coverage_screenshots.js";

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./", import.meta.url),
  keepProcessAlive: false,
  port: 0,
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  clientAutoreload: false,
  ribbon: false,
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
    "./client/main.test.html": {
      chromium: {
        runtime: chromium(),
      },
      firefox: {
        runtime: firefox({
          disableOnWindowsBecauseFlaky: true,
        }),
      },
      webkit: {
        runtime: webkit(),
      },
    },
  },
  // keepRunning: true,
  coverage: {
    include: {
      "./client/file.js": true,
    },
    methodForBrowsers: "istanbul",
  },
  githubCheck: false,
});

await takeCoverageScreenshots(
  testPlanResult,
  new URL("./screenshots/", import.meta.url),
  ["file.js"],
);
