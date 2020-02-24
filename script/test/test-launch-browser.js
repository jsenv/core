import { executeTestPlan, launchNode } from "@jsenv/core"
import * as jsenvConfig from "../../jsenv.config.js"

executeTestPlan({
  ...jsenvConfig,
  testPlan: {
    "test/launchBrowser/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
    "test/launchBrowserTab/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
