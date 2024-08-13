import { chromium, executeTestPlan, firefox, webkit } from "@jsenv/test";

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
    origin: "http://127.0.0.1:3459",
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
  githubCheck: false,
});
