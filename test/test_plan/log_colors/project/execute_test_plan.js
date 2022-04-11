import { executeTestPlan, nodeProcess } from "@jsenv/core"

await executeTestPlan({
  logLevel: "info",
  rootDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./file.js": {
      node: {
        runtime: nodeProcess,
        collectConsole: false,
      },
    },
  },
})
