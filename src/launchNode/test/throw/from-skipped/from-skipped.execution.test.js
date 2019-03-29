import { assert } from "@dmail/assert"
import { projectFolder } from "../../../../../projectFolder.js"
import { launchAndExecute } from "../../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../../server-compile/index.js"
import { launchNode } from "../../../launchNode.js"

// for this test filenameRelative is relative to ${workspaceFolder} because sourceMap
// are absolute so vscode will try to find source from the root defined
// in ${workspaceFolder}/.vscode/launch.json#sourceMapPathOverrides['/*']
const filenameRelative = `src/launchNode/test/throw/from-skipped/from-skipped.js`
const compileInto = ".dist"
const babelPluginDescription = {}

;(async () => {
  const sourceOrigin = `file://${projectFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder,
    compileInto,
    babelPluginDescription,
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
