/*
 * Execute all test files
 * - npm test
 * - npm test:coverage
 */

import { executeTestPlan, chromium, webkit, pingServer } from "@jsenv/core"

import { rootDirectoryUrl } from "../jsenv.config.mjs"

const devServerStarted = await pingServer(`http://127.0.0.1:3400`)
let devServer
if (!devServerStarted) {
  devServer = await import("./start_dev_server.mjs").devServer
}
try {
  await executeTestPlan({
    rootDirectoryUrl,
    testPlan: {
      "./tests/**/*.test.html": {
        chromium: {
          runtime: chromium,
        },
        webkit: {
          runtime: webkit,
        },
      },
    },
    coverageEnabled: process.argv.includes("--coverage"),
    coverageMethodForBrowsers: "istanbul",
  })
} finally {
  if (devServer) {
    devServer.stop()
  }
}
