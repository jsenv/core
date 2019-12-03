const { launchNode } = require("@jsenv/core")

const projectDirectoryPath = __dirname
exports.projectDirectoryPath = projectDirectoryPath

const testPlan = {
  "/test/**/*.test.js": {
    node: {
      launch: launchNode,
    },
  },
}
exports.testPlan = testPlan
