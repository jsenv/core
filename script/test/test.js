const { executeTestPlan, launchNode } = require("@jsenv/core")
const { projectDirectoryPath } = require("../../jsenv.config.js")

console.log(process.argv)

executeTestPlan({
  projectDirectoryPath,
  testPlan: {
    "test/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
  coverage: process.argv.includes("--coverage"),
})
