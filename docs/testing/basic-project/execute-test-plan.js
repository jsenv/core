const { executeTestPlan } = require("@jsenv/testing")
const { launchNode } = require("@jsenv/node-launcher")
const { launchChromium } = require("@jsenv/chromium-launcher")

executeTestPlan({
  projectPath: __dirname,
  executeDescription: {
    "/test/*.test.js": {
      browser: {
        launch: launchChromium,
      },
      node: {
        launch: launchNode,
      },
    },
    "/test/*.test.browser.js": {
      browser: {
        launch: launchChromium,
      },
    },
    "/test/*.test.node.js": {
      node: {
        launch: launchNode,
      },
    },
  },
  coverage: process.argv.includes("--cover"),
  coveraegConfig: {
    "/src/**/*.js": true,
  },
  coverageHtmlDirectory: true,
  coverageHtmlDirectoryRelativePath: "./coverage/",
  coverageJsonFile: true,
  coverageJsonFileRelativePath: "./coverage/coverage.json",
})
