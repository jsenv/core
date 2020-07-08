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
    "test/startExploring/**/*.test.js": {
      node: {
        launch: launchNode,
        // allocate more time (60s) for these tests, they can be long
        allocatedMs: 1000 * 60,
      },
    },
  },
})
