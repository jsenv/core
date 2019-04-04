import { assert } from "/node_modules/@dmail/assert/index.js"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")
const transformAsyncToPromises = import.meta.require("babel-plugin-transform-async-to-promises")

const testFolder = `${projectFolder}/test/launch-chromium/timeout`
const filenameRelative = `timeout.js`
const compileInto = ".dist"
const babelConfigMap = {
  "transform-async-to-promises": [transformAsyncToPromises],
}

;(async () => {
  const sourceOrigin = `file://${projectFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder: testFolder,
    compileInto,
    babelConfigMap,
  })

  const actual = await launchAndExecute({
    launch: ({ cancellationToken }) =>
      launchChromium({
        cancellationToken,
        compileInto,
        sourceOrigin,
        compileServerOrigin,
        headless: false,
      }),
    allocatedMs: 5000,
    stopOnceExecuted: true,
    captureConsole: true,
    filenameRelative,
    verbose: true,
  })
  const expected = {
    status: "timedout",
    platformLog: `foo
`,
  }
  assert({ actual, expected })
})()
