import { executeTestPlan, chromium, firefox, webkit } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.html": {
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
  webServer: {
    origin: "http://localhost:3457",
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
  failFast: process.argv.includes("--workspace"),
  logShortForCompletedExecutions: true,
  logMergeForCompletedExecutions: process.argv.includes("--workspace"),
});
