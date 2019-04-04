import { assert } from "/node_modules/@dmail/assert/index.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = projectFolder
// for this test filenameRelative is relative to ${workspaceFolder} because sourceMap
// are absolute so vscode will try to find source from the root defined
// in ${workspaceFolder}/.vscode/launch.json#sourceMapPathOverrides['/*']
const filenameRelative = `test/launch-node/throw-from-skipped/throw-from-skipped.js`
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
      launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin, debugPort: 40000 }),
    captureConsole: false,
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
