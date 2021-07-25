import { resourceUsage, memoryUsage } from "process"
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
const currentDirectoryRelativeUrl = new URL(currentDirectoryUrl, jsenvCoreDirectoryUrl)

// wait a bit to let Node.js cleanup things, otherwise heapUsed can be negative o_O
await new Promise((resolve) => {
  setTimeout(resolve, 500)
})

const beforeRessourceUsage = resourceUsage()
const beforeMemoryUsage = memoryUsage()
const beforeTime = Date.now()

const testPlan = {
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
}

await executeTestPlan({
  projectDirectoryUrl,
  testPlan,
  logLevel: "warn",
  compileServerProtocol: "https",
  coverage: true,
  coverageHtmlDirectory: false,
  coverageTextLog: false,
})

const afterRessourceUsage = resourceUsage()
const aftertMemoryUsage = memoryUsage()
const afterTime = Date.now()

export const msEllapsed = afterTime - beforeTime

export const heapUsed = aftertMemoryUsage.heapUsed - beforeMemoryUsage.heapUsed

export const fileSystemReadOperationCount = afterRessourceUsage.fsRead - beforeRessourceUsage.fsRead

export const fileSystemWriteOperationCount =
  afterRessourceUsage.fsWrite - beforeRessourceUsage.fsWrite
