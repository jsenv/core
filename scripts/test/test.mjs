import { executeTestPlan, nodeChildProcess } from "@jsenv/core"
import { rootDirectoryUrl, runtimeCompat } from "@jsenv/core/jsenv.config.mjs"

await executeTestPlan({
  rootDirectoryUrl,
  runtimeCompat,
  logLevel: "info",
  testPlan: {
    "tests/**/*.test.mjs": {
      node: {
        runtime: nodeChildProcess,
        allocatedMs: 30_000,
      },
    },
    "tests/**/coverage_universal.test.mjs": {
      node: {
        runtime: nodeChildProcess,
        allocatedMs: 60_000,
      },
    },
    "tests/**/*_browsers.test.mjs": {
      node: {
        runtime: nodeChildProcess,
        allocatedMs: 60_000,
      },
    },
  },
  // completedExecutionLogMerging: true,
  logMemoryHeapUsage: true,
  // completedExecutionLogMerging: true,
  // completedExecutionLogAbbreviation: false,
  coverageEnabled: process.argv.includes("--coverage"),
  coverageConfig: {
    "./index.js": true,
    "./src/**/*.js": true,
    "./packages/*/main.js": true,
    "./packages/*/src/*.js": true,
    "./**/*.test.*": false,
    "./**/test/": false,
  },
})
