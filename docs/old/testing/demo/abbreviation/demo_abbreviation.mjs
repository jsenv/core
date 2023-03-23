import { executeTestPlan, nodeChildProcess } from "@jsenv/core"

await executeTestPlan({
  logLevel: "info",
  testDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "*.spec.js": {
      node: {
        runtime: nodeChildProcess,
        captureConsole: true,
      },
    },
  },
  completedExecutionLogAbbreviation: true,
  completedExecutionLogMerging: false,
  defaultMsAllocatedPerExecution: 3000,
})
