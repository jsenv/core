/* global require */
const { executeTestPlan, launchNode } = require("@jsenv/core")
const jsenvConfig = require("../../jsenv.config.js")

executeTestPlan({
  ...jsenvConfig,
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
