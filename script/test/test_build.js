import { executeTestPlan, nodeRuntime } from "@jsenv/core"

import * as jsenvConfig from "../../jsenv.config.mjs"

await executeTestPlan({
  ...jsenvConfig,
  testPlan: {
    "test/**/build_**/*.test.js": {
      node: {
        runtime: nodeRuntime,
      },
    },
  },
})
