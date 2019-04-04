import { assert } from "/node_modules/@dmail/assert/index.js"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/launch-chromium/throw`
const filenameRelative = `throw.js`
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
        compileInto,
        sourceOrigin,
        compileServerOrigin,
        headless: false,
      }),
    stopOnceExecuted: true,
    mirrorConsole: true,
    filenameRelative,
    verbose: true,
  })
  const expected = {
    status: "errored",
    error: {
      stack: actual.error.stack,
      message: "error",
    },
  }
  assert({ actual, expected })
})()
