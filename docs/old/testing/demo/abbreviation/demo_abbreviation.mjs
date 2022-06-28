import { executeTestPlan, nodeProcess } from "@jsenv/core"

await executeTestPlan({
  roottDirectoryUrl: new URL("./", import.meta.url),
  logLevel: "info",
  testPlan: {
    "*.spec.js": {
      node: {
        runtime: nodeProcess,
        captureConsole: true,
      },
    },
  },
  completedExecutionLogAbbreviation: true,
  completedExecutionLogMerging: false,
  defaultMsAllocatedPerExecution: 3000,
})
