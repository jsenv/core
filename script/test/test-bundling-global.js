import { executeTestPlan, launchNode } from "@jsenv/core"
import * as jsenvConfig from "../../jsenv.config.js"

executeTestPlan({
  ...jsenvConfig,
  testPlan: {
    "test/generateBundle/global/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
