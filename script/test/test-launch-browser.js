import { executeTestPlan, launchNode } from "@jsenv/core"
import * as jsenvConfig from "../../jsenv.config.js"

executeTestPlan({
  ...jsenvConfig,
  testPlan: {
    "test/**/*-launch-browser/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
