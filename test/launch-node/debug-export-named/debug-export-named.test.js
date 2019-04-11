import { assert } from "@dmail/assert"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"

const transformAsyncToPromises = import.meta.require("babel-plugin-transform-async-to-promises")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = projectFolder
// for debugging I need filenameRelative
// to be relative to projectFolder so that vscode
// knows where sourcefiles are
const filenameRelative = `test/launch-node/debug-export-named/debug-export-named.js`
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
    launch: (options) => launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
    filenameRelative,
    mirrorConsole: true,
    verbose: true,
  })
  const expected = {
    status: "completed",
  }
  assert({ actual, expected })
})()
