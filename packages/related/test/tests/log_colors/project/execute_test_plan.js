import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

await executeTestPlan({
  logLevel: "info",
  logEachDuration: false,
  logSummary: false,
  rootDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./file.js": {
      node: {
        runtime: nodeWorkerThread(),
        collectConsole: false,
      },
    },
  },
});
