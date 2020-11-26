import { executeTestPlan, launchNode } from "@jsenv/core"
import * as jsenvConfig from "../../jsenv.config.js"

executeTestPlan({
  ...jsenvConfig,
  testPlan: {
    "test/buildProject/systemjs/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
