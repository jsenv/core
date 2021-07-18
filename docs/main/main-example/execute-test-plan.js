import { executeTestPlan, launchChromiumTab, launchFirefoxTab } from "@jsenv/core"

executeTestPlan({
  projectDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "**/*.test.html": {
      chromium: {
        launch: launchChromiumTab,
      },
      firefox: {
        launch: launchFirefoxTab,
      },
    },
    // "**/*.test.js": {
    //   node: {
    //     launch: launchNode,
    //   },
    // },
    "**/.jsenv/": null,
    "**/node_modules/": null,
  },
})
