import {
  chromium,
  executeTestPlan,
  firefox,
  nodeWorkerThread,
  webkit,
} from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../src/", import.meta.url),
  testPlan: {
    "./**/*.test.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
    "./**/*.test.html": {
      chromium: {
        runtime: chromium(),
      },
      firefox: {
        runtime: firefox({
          disableOnWindowsBecauseFlaky: true,
        }),
        allocatedMs: process.platform === "win32" ? 60_000 : 30_000,
      },
      webkit: {
        runtime: webkit(),
      },
    },
  },
  webServer: {
    origin: "http://localhost:3456",
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
  githubCheck: false,
});
