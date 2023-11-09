import { startDevServer } from "@jsenv/core";
import { executeTestPlan, chromium } from "@jsenv/test";

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./", import.meta.url),
  keepProcessAlive: false,
  port: 0,
});
await executeTestPlan({
  logLevel: "info",
  logRuntime: false,
  logEachDuration: false,
  logSummary: false,
  rootDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./client/main.html": {
      chrome: {
        runtime: chromium(),
        collectConsole: true,
      },
    },
  },
  webServer: {
    origin: devServer.origin,
  },
  githubCheckEnabled: false,
});
