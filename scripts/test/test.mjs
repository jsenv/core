import { executeTestPlan, nodeWorkerThread } from "@jsenv/core"

await executeTestPlan({
  rootDirectoryUrl: new URL("../../", import.meta.url),
  logLevel: "info",
  testPlan: process.argv.includes("--only-resource-hints")
    ? {
        "tests/**/resource_hints/**/*.test.mjs": {
          node: {
            runtime: nodeWorkerThread,
            allocatedMs: 30_000,
          },
        },
      }
    : {
        "tests/**/*.test.mjs": {
          node: {
            runtime: nodeWorkerThread,
            allocatedMs: 30_000,
          },
        },
        "tests/**/coverage_universal.test.mjs": {
          node: {
            runtime: nodeWorkerThread,
            allocatedMs: 60_000,
          },
        },
        "tests/**/preload_js_module_build.test.mjs": {
          node: {
            runtime: nodeWorkerThread,
            allocatedMs: 60_000,
          },
        },
        "tests/**/*_browsers.test.mjs": {
          node: {
            runtime: nodeWorkerThread,
            allocatedMs: 60_000,
          },
        },
        "tests/**/*_snapshots.test.mjs": {
          node: {
            runtime: nodeWorkerThread,
            allocatedMs: 180_000,
          },
        },
      },
  // completedExecutionLogMerging: true,
  logMemoryHeapUsage: true,
  // completedExecutionLogMerging: true,
  // completedExecutionLogAbbreviation: false,
  coverageEnabled: process.argv.includes("--coverage"),
  coverageConfig: {
    "./src/**/*.js": true,
    "./src/**/*.mjs": true,
    "./packages/*/src/*.js": true,
    "./packages/*/src/*.mjs": true,
    "./**/*.test.*": false,
    "./**/test/": false,
  },
})
