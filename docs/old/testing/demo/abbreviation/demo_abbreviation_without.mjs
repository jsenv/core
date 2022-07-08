import { executeTestPlan, nodeChildProcess } from "@jsenv/core"

await executeTestPlan({
  rootDirectoryUrl: new URL("./", import.meta.url),
  logLevel: "info",
  testPlan: {
    "*.spec.js": {
      node: {
        runtime: nodeChildProcess,
        captureConsole: true,
      },
    },
  },
  completedExecutionLogAbbreviation: false,
  completedExecutionLogMerging: false,
  defaultMsAllocatedPerExecution: 3000,
})
