import { assert } from "/node_modules/@dmail/assert/index.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = projectFolder
// for debugging I need filenameRelative
// to be relative to projectFolder so that vscode
// knows where sourcefiles are
const filenameRelative = `test/launch-node/debug-block-scoping/debug-block-scoping.js`
const compileInto = ".dist"
const babelConfigMap = { "transform-block-scoping": [] }

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
    verbose: true,
  })
  const expected = {
    status: "completed",
  }
  assert({ actual, expected })
})()
