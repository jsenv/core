import transformAsyncToPromises from "babel-plugin-transform-async-to-promises"
import { assert } from "@dmail/assert"
import { filenameToFileHref } from "@jsenv/module-resolution"
import { projectFolder } from "../../../projectFolder.js"
import { launchNode } from "../../launchNode.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { removeDebuggerLog } from "../removeDebuggerLog.js"

const filenameRelative = `src/launchNode/test/timeout/timeout.js`
const compileInto = "build"
const babelPluginDescription = {
  "transform-async-to-promises": [transformAsyncToPromises],
}

;(async () => {
  const sourceOrigin = filenameToFileHref(projectFolder)

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
    platformTypeForLog: "node process",
  })
  actual.platformLog = removeDebuggerLog(actual.platformLog)
  const expected = {
    status: "timedout",
    platformLog: `foo
`,
  }
  assert({ actual, expected })
})()
