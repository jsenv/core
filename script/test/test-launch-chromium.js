const { executeTestPlan, launchNode } = require("@jsenv/core")
const jsenvConfig = require("../../jsenv.config.js")

executeTestPlan({
  ...jsenvConfig,
  testPlan: {
    "test/launchChromium/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
    "test/launchChromiumTab/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
