import { executeTestPlan, launchNode } from "@jsenv/core"
import * as jsenvConfig from "../../jsenv.config.js"

await executeTestPlan({
  ...jsenvConfig,
  coverage: true,
  coverageIncludeMissing: false,
  testPlan: {
    "test/**/coverage-node.test.js": {
      node: {
        launch: launchNode,
        allocatedMs: Infinity,
      },
    },
  },
})
