import { executeTestPlan, launchNode } from "@jsenv/core"
import * as jsenvConfig from "../../jsenv.config.js"

executeTestPlan({
  ...jsenvConfig,
  testPlan: {
    "test/generateCommonJsBundle/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
    "test/generateCommonJsBundleForNode/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
