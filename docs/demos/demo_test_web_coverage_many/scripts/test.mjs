import { executeTestPlan, chromium, firefox, webkit } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.html": {
      chromium: {
        runtime: chromium(),
      },
      firefox: {
        runtime: firefox(),
      },
      webkit: {
        runtime: webkit(),
      },
    },
  },
  webServer: {
    origin: "http://localhost:3456",
    rootDirectoryUrl: new URL("../src/", import.meta.url),
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
  coverageEnabled: true,
  coverageReportJson: true,
  coverageMethodForBrowsers: "istanbul",
  coverageReportJsonFileUrl: new URL(
    "../.coverage/coverage.json",
    import.meta.url,
  ),
  coverageReportHtml: true,
  coverageReportHtmlDirectoryUrl: new URL("../.coverage/", import.meta.url),
});

// now open a chromium + take screenshot
