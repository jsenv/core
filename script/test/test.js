const { executeTestPlan, launchNode } = require("../../dist/commonjs/main.js")
const jsenvConfig = require("../../jsenv.config.js")

executeTestPlan({
  ...jsenvConfig,
  testPlan: {
    "test/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
  coverage: process.argv.includes("--coverage"),
})
