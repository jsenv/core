import { executeTestPlan, launchNode, launchChromiumTab } from "@jsenv/core"

executeTestPlan({
  logLevel: "debug",
  projectDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./*.test.js": {
      browser: {
        launch: launchChromiumTab,
      },
      node: {
        launch: (options) => launchNode({ ...options, debugMode: "none" }),
      },
    },
  },
})
