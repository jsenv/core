import {
  executeTestPlan,
  nodeChildProcess,
  nodeWorkerThread,
} from "@jsenv/core"
import { rootDirectoryUrl, runtimeCompat } from "@jsenv/core/jsenv.config.mjs"

const nodeRuntime =
  // on windows using worker_thread often generates
  // "FATAL ERROR: v8::FromJust Maybe value is Nothing"
  // Which is a segmentation fault caused by too much memory/process usage (I guess)
  // on windows it's better to use child_process until it gets fixed
  process.platform === "win32" ? nodeChildProcess : nodeWorkerThread

await executeTestPlan({
  rootDirectoryUrl,
  runtimeCompat,
  logLevel: "info",
  testPlan: {
    "tests/**/*.test.mjs": {
      node: {
        runtime: nodeRuntime,
        allocatedMs: 30_000,
      },
    },
    "tests/**/coverage_universal.test.mjs": {
      node: {
        runtime: nodeRuntime,
        allocatedMs: 60_000,
      },
    },
    "tests/**/*_browsers.test.mjs": {
      node: {
        runtime: nodeRuntime,
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
