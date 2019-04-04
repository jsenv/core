import { assert } from "/node_modules/@dmail/assert/index.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"
import { removeDebuggerLog } from "../removeDebuggerLog.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")
// for this test filenameRelative is relative to ${workspaceFolder} because sourceMap
// are absolute so vscode will try to find source from the root defined
// in ${workspaceFolder}/.vscode/launch.json#sourceMapPathOverrides['/*']
const filenameRelative = `test/launch-node/throw/throw.js`
const compileInto = ".dist"
const babelConfigMap = {}

;(async () => {
  const sourceOrigin = `file://${projectFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder,
    compileInto,
    babelConfigMap,
  })

  const actual = await launchAndExecute({
    launch: (options) =>
      launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin, debugPort: 40000 }),
    captureConsole: true,
    mirrorConsole: true,
    filenameRelative,
    verbose: true,
  })
  actual.platformLog = removeDebuggerLog(actual.platformLog)
  const expected = {
    status: "errored",
    error: {
      stack: actual.error.stack,
      message: "error",
    },
    platformLog: `${actual.error.stack}
`,
  }
  assert({ actual, expected })
})()
