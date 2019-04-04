import { assert } from "/node_modules/@dmail/assert/index.js"
import { launchAndExecute, startCompileServer, launchChromium } from "../../../index.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/launch-chromium/not-found`
const filenameRelative = `not-found.js`
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
    launch: () =>
      launchChromium({ compileInto, sourceOrigin, compileServerOrigin, headless: false }),
    stopOnceExecuted: true,
    mirrorConsole: true,
    verbose: true,
    filenameRelative,
  })
  const expected = {
    status: "errored",
    error: {
      code: "MODULE_NOT_FOUND_ERROR",
      message: `src/launchChromium/test/not-found/foo.js not found`,
      stack: actual.error.stack,
      url: `${compileServerOrigin}/${compileInto}/best/src/launchChromium/test/not-found/foo.js`,
    },
  }
  assert({ actual, expected })
})()
