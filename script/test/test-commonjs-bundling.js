const { executeTestPlan, launchNode } = require("@jsenv/core")
const { projectDirectoryPath } = require("../../jsenv.config.js")

executeTestPlan({
  projectDirectoryPath,
  testPlan: {
    "test/generateCommonJsBundle/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
    "test/generateCommonJsBundleForNode/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
