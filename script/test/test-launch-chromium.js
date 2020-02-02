import { executeTestPlan, launchNode } from "@jsenv/core"
import * as jsenvConfig from "../../jsenv.config.js"

executeTestPlan({
  ...jsenvConfig,
  testPlan: {
    "test/launchChromium/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
    "test/launchChromiumTab/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
