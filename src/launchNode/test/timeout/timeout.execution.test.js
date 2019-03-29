import { assert } from "/node_modules/@dmail/assert/index.js"
import { projectFolder } from "../../../../projectFolder.js"
import { launchNode } from "../../launchNode.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { removeDebuggerLog } from "../removeDebuggerLog.js"

const transformAsyncToPromises = import.meta.require("babel-plugin-transform-async-to-promises")

const filenameRelative = `src/launchNode/test/timeout/timeout.js`
const compileInto = ".dist"
const babelPluginDescription = {
  "transform-async-to-promises": [transformAsyncToPromises],
}

;(async () => {
  const sourceOrigin = `file://${projectFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder,
    compileInto,
    babelPluginDescription,
  })

  const actual = await launchAndExecute({
    launch: (options) => launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
    allocatedMs: 5000,
    captureConsole: true,
    filenameRelative,
    verbose: true,
  })
  actual.platformLog = removeDebuggerLog(actual.platformLog)
  const expected = {
    status: "timedout",
    platformLog: `foo
`,
  }
  assert({ actual, expected })
})()
