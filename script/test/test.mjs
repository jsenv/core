import { executeTestPlan, nodeProcess } from "@jsenv/core"
import { rootDirectoryUrl, runtimeCompat } from "@jsenv/core/jsenv.config.mjs"

await executeTestPlan({
  rootDirectoryUrl,
  runtimeCompat,
  logLevel: "info",
  testPlan: {
    "test/**/*.test.mjs": {
      node: {
        runtime: nodeProcess,
        allocatedMs: 30 * 1000,
      },
    },
  },
  // completedExecutionLogMerging: true,
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
