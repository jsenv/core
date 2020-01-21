/* global require */
const { executeTestPlan, launchNode } = require("@jsenv/core")
const jsenvConfig = require("../../jsenv.config.js")

executeTestPlan({
  ...jsenvConfig,
  testPlan: {
    "test/transformJs/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
