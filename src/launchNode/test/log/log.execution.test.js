import { assert } from "@dmail/assert"
import { filenameToFileHref } from "@jsenv/module-resolution"
import { rootname } from "../../../rootname.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchNode } from "../../launchNode.js"
import { removeDebuggerLog } from "../removeDebuggerLog.js"

const filenameRelative = `src/launchNode/test/log/log.js`
const compileInto = "build"
const pluginMap = {}

;(async () => {
  const sourceOrigin = filenameToFileHref(rootname)

  const { origin: compileServerOrigin } = await startCompileServer({
    rootname,
    compileInto,
    pluginMap,
  })

  const actual = await launchAndExecute({
    launch: (options) =>
      launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
    captureConsole: true,
    filenameRelative,
    verbose: true,
    platformTypeForLog: "node process",
  })
  actual.platformLog = removeDebuggerLog(actual.platformLog)
  const expected = {
    status: "completed",
    platformLog: `foo
bar
`,
  }
  assert({ actual, expected })
})()
