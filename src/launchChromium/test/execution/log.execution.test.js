import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../../localRoot.js"
import { executeFile } from "../../../executeFile.js"
import { launchChromium } from "../../launchChromium.js"
import { removeDebuggerLog } from "../removeDebuggerLog.js"

const file = `src/launchChromium/test/fixtures/log.js`
const compileInto = "build"
const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})

;(async () => {
  const actual = await executeFile(file, {
    localRoot,
    compileInto,
    pluginMap,
    launchPlatform: (options) => launchChromium({ headless: false, ...options }),
    platformTypeForLog: "chromium browser",
    verbose: true,
    stopOnceExecuted: true,
    captureConsole: true,
    mirrorConsole: true,
  })
  debugger
  actual.capturedConsole = removeDebuggerLog(actual.capturedConsole)
  const expected = {
    status: "completed",
    capturedConsole: "",
  }
  assert({ actual, expected })
})()
