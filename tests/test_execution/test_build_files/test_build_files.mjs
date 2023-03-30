/*
 * The goal here is to ensure test plan can be used with an other server
 * than jsenvs
 */

import { startBuildServer, executeTestPlan, chromium } from "@jsenv/core"

const buildServer = await startBuildServer({
  logLevel: "warn",
  buildDirectoryUrl: new URL("./project/src/", import.meta.url),
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
  keepRunning: true,
  serverOrigin: buildServer.origin,
  serverRootDirectoryUrl: new URL("./project/src/", import.meta.url),
})

console.log(result)
