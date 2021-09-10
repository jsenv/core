import { resourceUsage, memoryUsage } from "node:process"

import {
  executeTestPlan,
  launchChromium,
  launchFirefox,
  launchWebkit,
  launchNode,
} from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

const projectDirectoryUrl = jsenvCoreDirectoryUrl
const currentDirectoryUrl = new URL("./", import.meta.url)
const currentDirectoryRelativeUrl = new URL(
  currentDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const executeTestPlanParameters = {
  projectDirectoryUrl,
  testPlan: {
    [`${currentDirectoryRelativeUrl}animals.test.html`]: {
      chromium: {
        launch: launchChromium,
        measureDuration: false,
        captureConsole: false,
      },
      firefox: {
        launch: launchFirefox,
        measureDuration: false,
        captureConsole: false,
      },
      webkit: {
        launch: launchWebkit,
        measureDuration: false,
        captureConsole: false,
      },
    },
    [`${currentDirectoryRelativeUrl}animals.test.js`]: {
      node: {
        launch: launchNode,
        measureDuration: false,
        captureConsole: false,
      },
    },
  },
  logLevel: "warn",
  compileServerProtocol: "http",
  coverage: true,
  coverageHtmlDirectory: false,
  coverageTextLog: false,
  compileServerCanReadFromFilesystem: false,
  compileServerCanWriteOnFilesystem: false,
}

// here we should also clean jsenv directory to ensure
// the compile server cannot reuse cache
// to mitigate this compileServerCanReadFromFilesystem and compileServerCanWriteOnFilesystem
// are false for now

global.gc()
const beforeHeapUsed = memoryUsage().heapUsed
const beforeRessourceUsage = resourceUsage()
const beforeMs = Date.now()

await executeTestPlan(executeTestPlanParameters)

const afterMs = Date.now()
const afterHeapUsed = memoryUsage().heapUsed
const afterRessourceUsage = resourceUsage()

const msEllapsed = afterMs - beforeMs
const heapUsed = afterHeapUsed - beforeHeapUsed
const fileSystemReadOperationCount =
  afterRessourceUsage.fsRead - beforeRessourceUsage.fsRead
const fileSystemWriteOperationCount =
  afterRessourceUsage.fsWrite - beforeRessourceUsage.fsWrite
process.send({
  heapUsed,
  msEllapsed,
  fileSystemReadOperationCount,
  fileSystemWriteOperationCount,
})
