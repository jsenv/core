import { executeTestPlan, nodeProcess } from "@jsenv/core"

import { rootDirectoryUrl, runtimeSupport } from "../../jsenv.config.mjs"

await executeTestPlan({
  rootDirectoryUrl,
  runtimeSupport,
  logLevel: "debug",
  testPlan: {
    "test/**/*.test.js": {
      node: {
        runtime: nodeProcess,
        allocatedMs: 30 * 1000,
      },
    },
    // give more time to some tests
    "test/coverage/**/*.test.js": {
      node: {
        runtime: nodeProcess,
        allocatedMs: 60 * 1000,
      },
    },
    "test/dev_server/**/*.test.js": {
      node: {
        runtime: nodeProcess,
        allocatedMs: 60 * 1000,
      },
    },
    "test/execute/**/*.test.js": {
      node: {
        runtime: nodeProcess,
        allocatedMs: 60 * 1000,
      },
    },
    "test/test_plan/**/*.test.js": {
      node: {
        runtime: nodeProcess,
        allocatedMs: 60 * 1000,
      },
    },
  },
  completedExecutionLogMerging: true,
  logMemoryHeapUsage: true,
  // completedExecutionLogMerging: true,
  // completedExecutionLogAbbreviation: false,
  coverage: process.argv.includes("--coverage"),
  coverageConfig: {
    "./index.js": true,
    "./src/**/*.js": true,
    "./packages/*/main.js": true,
    "./packages/*/src/*.js": true,
    "./**/*.test.*": false,
    "./**/test/": false,
  },
})
