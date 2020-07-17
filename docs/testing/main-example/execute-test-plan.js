import { executeTestPlan, launchNode, launchChromiumTab } from "@jsenv/core"

executeTestPlan({
  projectDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./*.test.html": {
      chromium: {
        launch: launchChromiumTab,
      },
    },
    "./*.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
