import { executeTestPlan, nodeRuntime } from "@jsenv/core"

import * as jsenvConfig from "../../jsenv.config.mjs"

await executeTestPlan({
  ...jsenvConfig,
  testPlan: {
    "test/**/*.test.js": {
      node: {
        runtime: nodeRuntime,
        allocatedMs: 60 * 1000,
      },
    },
    // give more time to the first test because it generates many file cached afterwards
    "test/__internal__/buildServiceWorker/basic/*.test.js": {
      node: {
        runtime: nodeRuntime,
        allocatedMs: 180 * 1000,
      },
    },
    "test/__internal__/executeTestPlan/**/*.test.js": {
      node: {
        runtime: nodeRuntime,
        allocatedMs: 180 * 1000,
      },
    },
  },
  coverage: process.argv.includes("--coverage"),
  coverageConfig: {
    "./index.js": true,
    "./src/**/*.js": true,
    "./**/*.test.*": false,
    "./**/test/": false,
  },
})
