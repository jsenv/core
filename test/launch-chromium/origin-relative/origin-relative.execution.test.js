import { assert } from "/node_modules/@dmail/assert/index.js"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"

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
    launch: () =>
      launchChromium({ compileInto, sourceOrigin, compileServerOrigin, headless: false }),
    verbose: true,
    stopOnceExecuted: true,
    mirrorConsole: true,
    filenameRelative,
    collectNamespace: true,
  })
  const expected = {
    status: "completed",
    namespace: {
      default: 42,
    },
  }
  assert({ actual, expected })
})()
