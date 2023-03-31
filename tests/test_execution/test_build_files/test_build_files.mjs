/*
 * The goal here is to ensure test plan can be used with an other server
 * than jsenvs
 */

import { startBuildServer, executeTestPlan, chromium } from "@jsenv/core"

const buildServer = await startBuildServer({
  logLevel: "warn",
  buildDirectoryUrl: new URL("./project/public/", import.meta.url),
  keepProcessAlive: false,
})

const result = await executeTestPlan({
  logLevel: "info",
  rootDirectoryUrl: new URL("./project/", import.meta.url),
  testPlan: {
    "./src/**/*.test.html": {
      chromium: {
        runtime: chromium,
      },
    },
  },
  // keepRunning: true,
  webServer: {
    origin: buildServer.origin,
    rootDirectoryUrl: new URL("./project/public/", import.meta.url),
  },
})

// TODO: assert on result
console.log(result)
