import { assert } from "/node_modules/@dmail/assert/index.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"

const transformAsyncToPromises = import.meta.require("babel-plugin-transform-async-to-promises")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/launch-node/async-to-promise`
const filenameRelative = `async.js`
const compileInto = ".dist"
const babelConfigMap = {
  "transform-async-to-promises": [transformAsyncToPromises],
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
      launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin, debugPort: 40000 }),
    filenameRelative,
    verbose: true,
  })
  const expected = {
    status: "completed",
  }
  assert({ actual, expected })
})()
