import { assert } from "@dmail/assert"
import { pathnameToFileHref } from "@jsenv/module-resolution"
import { projectFolder } from "../../../projectFolder.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchNode } from "../../launchNode.js"
import { removeDebuggerLog } from "../removeDebuggerLog.js"

const filenameRelative = `src/launchNode/test/throw/throw.js`
const compileInto = "build"
const babelPluginDescription = {}

;(async () => {
  const sourceOrigin = pathnameToFileHref(projectFolder)

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder,
    compileInto,
    babelPluginDescription,
  })

  const actual = await launchAndExecute({
    launch: (options) => launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
    captureConsole: true,
    mirrorConsole: true,
    filenameRelative,
    verbose: true,
    platformTypeForLog: "node process",
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
