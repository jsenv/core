import { assert } from "/node_modules/@dmail/assert/index.js"
import { launchAndExecute, launchChromium, startCompileServer } from "../../../index.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")
const transformAsyncToPromises = import.meta.require("babel-plugin-transform-async-to-promises")

const testFolder = `${projectFolder}/test/launch-chromium/dynamic-import`
const filenameRelative = `dynamic-import.js`
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
    launch: (options) =>
      launchChromium({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
    verbose: true,
    stopOnceExecuted: true,
    collectNamespace: true,
    filenameRelative,
  })
  const expected = {
    status: "completed",
    namespace: {
      default: 42,
    },
  }
  assert({ actual, expected })
})()
