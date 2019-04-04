import { assert } from "/node_modules/@dmail/assert/index.js"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")
const transformBlockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const transformAsyncToPromises = import.meta.require("babel-plugin-transform-async-to-promises")

const testFolder = `${projectFolder}/test/launch-chromium/top-level-await`
const filenameRelative = `top-level-await.js`
const compileInto = ".dist"
const babelConfigMap = {
  "transform-async-to-promises": [transformAsyncToPromises],
  "transform-block-scoping": [transformBlockScoping],
}

;(async () => {
  const sourceOrigin = `file://${testFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder: testFolder,
    compileInto,
    babelConfigMap,
  })

  const actual = await launchAndExecute({
    launch: (options) =>
      launchChromium({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
    stopOnceExecuted: true,
    collectNamespace: true,
    filenameRelative,
    verbose: true,
  })
  const expected = {
    status: "completed",
    namespace: {
      default: 10,
    },
  }
  assert({ actual, expected })
})()
