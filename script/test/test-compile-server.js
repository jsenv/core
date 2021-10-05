import { executeTestPlan, launchNode } from "@jsenv/core"

import * as jsenvConfig from "../../jsenv.config.mjs"

executeTestPlan({
  ...jsenvConfig,
  testPlan: {
    "test/**/startCompileServer/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
