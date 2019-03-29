import { assert } from "/node_modules/@dmail/assert/index.js"
import { projectFolder } from "../../../../projectFolder.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchNode } from "../../launchNode.js"
import { removeDebuggerLog } from "../removeDebuggerLog.js"

const testFolder = `${projectFolder}/src/launchNode/test/disconnect`
const filenameRelative = `disconnect.js`
const compileInto = ".dist"
const babelPluginDescription = {}

;(async () => {
  const sourceOrigin = `file://${testFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder: testFolder,
    compileInto,
    babelPluginDescription,
  })

  const actual = await launchAndExecute({
    launch: (options) => launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
    captureConsole: true,
    filenameRelative,
    verbose: true,
  })
  actual.platformLog = removeDebuggerLog(actual.platformLog)
  const expected = {
    status: "disconnected",
    platformLog: `here
`,
  }
  assert({ actual, expected })
})()
