import { executeTestPlan, launchNode } from "@jsenv/core"
import * as jsenvConfig from "../../jsenv.config.js"

executeTestPlan({
  ...jsenvConfig,
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
  coverage: process.argv.includes("--coverage"),
  // completedExecutionLogMerging: true,
})
