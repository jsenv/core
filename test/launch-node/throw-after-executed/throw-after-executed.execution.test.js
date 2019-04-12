import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"
import { removeDebuggerLog } from "../removeDebuggerLog.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `throw-after-executed.js`
const compileInto = ".dist"
const babelConfigMap = {}

const sourceOrigin = `file://${testFolder}`

const { origin: compileServerOrigin } = await startCompileServer({
  verbose: false,
  projectFolder: testFolder,
  compileInto,
  babelConfigMap,
})

const actual = await launchAndExecute({
  launch: (options) => launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
  captureConsole: true,
  filenameRelative,
  verbose: false,
})
actual.platformLog = removeDebuggerLog(actual.platformLog)
const expected = {
  status: "completed",
  platformLog: "",
}
assert({ actual, expected })
