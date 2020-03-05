import { executeTestPlan, launchNode, launchChromiumTab } from "@jsenv/core"

executeTestPlan({
  projectDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./test/*.test.js": {
      browser: {
        launch: launchChromiumTab,
      },
      node: {
        launch: launchNode,
      },
    },
    "./test/*.test.browser.js": {
      browser: {
        launch: launchChromiumTab,
      },
    },
    "./test/*.test.node.js": {
      node: {
        launch: launchNode,
      },
    },
  },
  coverageConfig: {
    "./getRuntimeName.js": true,
  },
  coverageHtmlDirectory: true,
  coverageHtmlDirectoryRelativeUrl: "./coverage/",
  coverageJsonFile: true,
  coverageJsonFileRelativeUrl: "./coverage/coverage.json",
})
