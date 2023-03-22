import {
  pingServer,
  executeTestPlan,
  chromium,
  firefox,
  webkit,
  nodeWorkerThread,
} from "@jsenv/core"

const devServerOrigin = "http://localhost:3457"
const devServerStarted = await pingServer(devServerOrigin)
let devServerModule
if (!devServerStarted) {
  devServerModule = await import("./start_dev_server.mjs")
}

try {
  await executeTestPlan({
    sourceDirectoryUrl: new URL("../src/", import.meta.url),
    devServerOrigin,
    testPlan: {
      "**/*.test.mjs": {
        node: {
          runtime: nodeWorkerThread,
        },
      },
      "**/*.test.html": {
        chromium: {
          runtime: chromium,
          allocatedMs: 90_000,
        },
        firefox: {
          runtime: firefox,
          allocatedMs: 90_000,
        },
        webkit: {
          runtime: webkit,
          allocatedMs: 90_000,
        },
      },
    },
    failFast: process.argv.includes("--workspace"),
    completedExecutionLogMerging: process.argv.includes("--workspace"),
  })
} finally {
  if (devServerModule) {
    devServerModule.devServer.stop()
  }
}
