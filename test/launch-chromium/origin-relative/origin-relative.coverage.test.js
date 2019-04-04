import { assert } from "/node_modules/@dmail/assert/index.js"
import { launchAndExecute, startCompileServer, launchChromium } from "../../../index.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/launch-chromium/origin-relative`
const filenameRelative = `folder/file.js`
const compileInto = ".dist"
const babelConfigMap = {}

;(async () => {
  const sourceOrigin = `file://${testFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder: testFolder,
    compileInto,
    babelConfigMap,
  })

  const actual = await launchAndExecute({
    launch: (options) =>
      launchChromium({
        ...options,
        sourceOrigin,
        compileInto,
        compileServerOrigin,
        headless: false,
      }),
    verbose: true,
    stopOnceExecuted: true,
    mirrorConsole: true,
    filenameRelative,
    collectNamespace: true,
    collectCoverage: true,
  })
  const expected = {
    status: "completed",
    namespace: {
      default: 42,
    },
    coverageMap: {
      "/absolute-import.js": actual.coverageMap["absolute-import.js"],
      "/dependency.js": actual.coverageMap["/dependency.js"],
    },
  }
  assert({ actual, expected })
})()
