/* global require, __dirname */
const { executeTestPlan, launchNode, launchChromiumTab } = require("@jsenv/core")

executeTestPlan({
  projectDirectoryUrl: __dirname,
  testPlan: {
    "test/*.test.js": {
      browser: {
        launch: launchChromiumTab,
      },
      node: {
        launch: launchNode,
      },
    },
    "test/*.test.browser.js": {
      browser: {
        launch: launchChromiumTab,
      },
    },
    "test/*.test.node.js": {
      node: {
        launch: launchNode,
      },
    },
  },
  coverage: process.argv.includes("--cover"),
  coverageConfig: {
    "src/**/*.js": true,
  },
  coverageHtmlDirectory: true,
  coverageHtmlDirectoryRelativeUrl: "./coverage/",
  coverageJsonFile: true,
  coverageJsonFileRelativeUrl: "./coverage/coverage.json",
})
