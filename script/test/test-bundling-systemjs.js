import { executeTestPlan, launchNode } from "@jsenv/core"
import * as jsenvConfig from "../../jsenv.config.js"

executeTestPlan({
  ...jsenvConfig,
  testPlan: {
    "test/generateBundle/systemjs/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
