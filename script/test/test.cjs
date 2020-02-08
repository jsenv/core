/* globals require, __dirname  */
const { executeTestPlan, launchNode } = require("@jsenv/core")
const { resolveUrl, fileSystemPathToUrl } = require("@jsenv/util")

executeTestPlan({
  projectDirectoryUrl: resolveUrl("../", fileSystemPathToUrl(__dirname)),
  testPlan: {
    "test/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
    "test/execute/basic/file.chromium.test.js": {
      node: {
        launch: launchNode,
        allocatedMs: 1000 * 60,
      },
    },
  },
  completedExecutionLogMerging: true,
})
