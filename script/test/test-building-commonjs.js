import { executeTestPlan, launchNode } from "@jsenv/core"
import * as jsenvConfig from "../../jsenv.config.js"

executeTestPlan({
  ...jsenvConfig,
  testPlan: {
    "test/**/*-build-commonjs/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
