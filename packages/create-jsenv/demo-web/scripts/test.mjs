/*
 * Execute all test files
 * - npm test
 * - npm test:coverage
 */

import { executeTestPlan, firefox, pingServer } from "@jsenv/core"

import { rootDirectoryUrl } from "../jsenv.config.mjs"

const devServerOrigin = "http://localhost:3400"
const devServerStarted = await pingServer(devServerOrigin)
let devServer
if (!devServerStarted) {
  devServer = (await import("./start_dev_server.mjs")).devServer
}
try {
  await executeTestPlan({
    rootDirectoryUrl,
    devServerOrigin,
    testPlan: {
      "./tests/**/*.test.html": {
        firefox: {
          runtime: firefox,
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
