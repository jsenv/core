import { parentPort } from "node:worker_threads"
import { resourceUsage, memoryUsage } from "node:process"

global.gc()
const beforeHeapUsed = memoryUsage().heapUsed
const beforeRessourceUsage = resourceUsage()
const beforeMs = Date.now()

const {
  executeTestPlan,
  launchChromium,
  launchFirefox,
  launchWebkit,
  launchNode,
} = await import("@jsenv/core")

const projectDirectoryUrl = new URL("../../../", import.meta.url)
const currentDirectoryUrl = new URL("./", import.meta.url)
const currentDirectoryRelativeUrl = new URL(
  currentDirectoryUrl,
  projectDirectoryUrl,
)
await executeTestPlan({
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
  // here we should also clean jsenv directory to ensure
  // the compile server cannot reuse cache
  // to mitigate this compileServerCanReadFromFilesystem and compileServerCanWriteOnFilesystem
  // are false for now
  compileServerCanReadFromFilesystem: false,
  compileServerCanWriteOnFilesystem: false,
})

const afterMs = Date.now()
const afterHeapUsed = memoryUsage().heapUsed
const afterRessourceUsage = resourceUsage()

const msEllapsed = afterMs - beforeMs
const heapUsed = afterHeapUsed - beforeHeapUsed
const fileSystemReadOperationCount =
  afterRessourceUsage.fsRead - beforeRessourceUsage.fsRead
const fileSystemWriteOperationCount =
  afterRessourceUsage.fsWrite - beforeRessourceUsage.fsWrite
parentPort.postMessage({
  heapUsed,
  msEllapsed,
  fileSystemReadOperationCount,
  fileSystemWriteOperationCount,
})
