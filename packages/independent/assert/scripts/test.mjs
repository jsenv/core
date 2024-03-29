import {
  executeTestPlan,
  chromium,
  firefox,
  webkit,
  nodeWorkerThread,
} from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
    "./src/**/*.test.html": {
      chromium: {
        runtime: chromium(),
        allocatedMs: 90_000,
      },
      firefox: {
        runtime: firefox({
          disableOnWindowsBecauseFlaky: true,
        }),
        allocatedMs: 90_000,
      },
      webkit: {
        runtime: webkit(),
        allocatedMs: 90_000,
      },
    },
  },
  webServer: {
    origin: "http://localhost:3457",
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
  githubCheck: false,
});
