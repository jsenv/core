import { executeTestPlan, chromium, reportCoverageAsHtml } from "@jsenv/test";
import { takeCoverageScreenshots } from "../../take_coverage_screenshots.js";

const testPlanResult = await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./client/**/file.test.html": {
      chromium: {
        runtime: chromium(),
      },
    },
  },
  webServer: {
    origin: "http://localhost:3456",
    rootDirectoryUrl: new URL("../client/", import.meta.url),
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
  coverage: true,
});

await reportCoverageAsHtml(
  testPlanResult,
  new URL("../.coverage/", import.meta.url),
);
await takeCoverageScreenshots(
  new URL("../.coverage/", import.meta.url),
  {
    "file.js": new URL("./file.js.png", import.meta.url),
  },
  {
    width: 640,
    height: 280,
  },
);
