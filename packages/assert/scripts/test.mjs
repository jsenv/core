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
    rootDirectoryUrl: new URL("../", import.meta.url),
    devServerOrigin,
    testPlan: {
      "tests/**/*.test.mjs": {
        node: {
          runtime: nodeWorkerThread,
        },
      },
      "tests/**/*.test.html": {
        chromium: {
          runtime: chromium,
        },
        firefox: {
          runtime: firefox,
        },
        webkit: {
          runtime: webkit,
        },
      },
    },
  })
} finally {
  if (devServerModule) {
    devServerModule.devServer.stop()
  }
}
