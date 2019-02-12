import { assert } from "@dmail/assert"
import { localRoot } from "../../../localRoot.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { launchChromium } from "../../launchChromium.js"
import {
  coverageMapToAbsolute,
  coverageMapLog,
  coverageMapHTML,
} from "../../../executionPlanToCoverageMap/index.js"

const file = `src/launchChromium/test/absolute-import/absolute-import.js`
const compileInto = "build"
const pluginMap = {}

;(async () => {
  const { origin: remoteRoot } = await startCompileServer({
    localRoot,
    compileInto,
    pluginMap,
  })

  const actual = await launchAndExecute({
    launch: launchChromium({ localRoot, remoteRoot, compileInto, headless: false }),
    platformTypeForLog: "chromium browser",
    verbose: true,
    stopOnceExecuted: true,
    mirrorConsole: true,
    file,
    collectNamespace: true,
    collectCoverage: true,
  })
  const expected = {
    status: "completed",
    namespace: {
      default: 42,
    },
    coverageMap: {
      "src/launchChromium/test/absolute-import/absolute-import.js":
        actual.coverageMap["src/launchChromium/test/absolute-import/absolute-import.js"],
      "src/launchChromium/test/absolute-import/dependency.js":
        actual.coverageMap["src/launchChromium/test/absolute-import/dependency.js"],
    },
  }
  assert({ actual, expected })

  const absoluteCoverageMap = coverageMapToAbsolute(actual.coverageMap, localRoot)
  coverageMapLog(absoluteCoverageMap)
  coverageMapHTML(absoluteCoverageMap)
})()
