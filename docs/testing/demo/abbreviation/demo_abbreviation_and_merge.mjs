import { executeTestPlan, nodeProcess } from "@jsenv/core"

await executeTestPlan({
  rootDirectoryUrl: new URL("./", import.meta.url),
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
  completedExecutionLogMerging: true,
  defaultMsAllocatedPerExecution: 3000,
})
