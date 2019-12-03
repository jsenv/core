const { executeTestPlan, launchNode, launchChromium } = require("@jsenv/core")

executeTestPlan({
  projectDirectoryPath: __dirname,
  testPlan: {
    "test/*.test.js": {
      browser: {
        launch: launchChromium,
      },
      node: {
        launch: launchNode,
      },
    },
    "test/*.test.browser.js": {
      browser: {
        launch: launchChromium,
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
