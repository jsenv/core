import { executeTestPlan, nodeRuntime } from "@jsenv/core"

import * as jsenvConfig from "../../jsenv.config.mjs"

await executeTestPlan({
  ...jsenvConfig,
  coverage: true,
  coverageIncludeMissing: false,
  coverageHtmlDirectory: null,
  coverageTextLog: false,
  testPlan: {
    "test/**/coverage-node.test.js": {
      node: {
        runtime: nodeRuntime,
        allocatedMs: Infinity,
      },
    },
  },
  coverageConfig: {
    "./index.js": true,
    "./src/**/*.js": true,
    "./src/**/continuous-testing/": false,
    "./**/*.test.*": false,
    "./**/test/": false,
  },
})
