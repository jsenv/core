/*
 * Execute all test files
 * - npm test
 * - npm test:coverage
 */

import { executeTestPlan, chromium, pingServer } from "@jsenv/core"

const devServerOrigin = "http://localhost:3400"
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
      "./**/*.test.html": {
        firefox: {
          runtime: chromium,
        },
      },
    },
    coverageEnabled: process.argv.includes("--coverage"),
    coverageMethodForBrowsers: "istanbul",
  })
} finally {
  if (devServerModule) {
    devServerModule.devServer.stop()
  }
}
