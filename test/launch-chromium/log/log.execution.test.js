import { assert } from "/node_modules/@dmail/assert/index.js"
import { launchChromium, launchAndExecute, startCompileServer } from "../../../index.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/launch-chromium/log`
const filenameRelative = `log.js`
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
    captureConsole: true,
    filenameRelative,
    verbose: true,
  })
  const expected = {
    status: "completed",
    platformLog: `foo
bar
`,
  }
  assert({ actual, expected })
})()
