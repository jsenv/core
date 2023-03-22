import {
  pingServer,
  executeTestPlan,
  chromium,
  firefox,
  webkit,
  nodeWorkerThread,
} from "@jsenv/core"

const devServerOrigin = "http://localhost:3456"
const devServerStarted = await pingServer(devServerOrigin)
let devServerModule
if (!devServerStarted) {
  devServerModule = await import("./dev.mjs")
}
try {
  await executeTestPlan({
    sourceDirectoryUrl: new URL("../src/", import.meta.url),
    devServerOrigin,
    testPlan: {
      "**/*.test.js": {
        node: {
          runtime: nodeWorkerThread,
        },
      },
      "**/*.test.html": {
        chromium: {
          runtime: chromium,
        },
        firefox: {
          runtime: firefox,
          allocatedMs: process.platform === "win32" ? 60_000 : 30_000,
        },
        webkit: {
          runtime: webkit,
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
