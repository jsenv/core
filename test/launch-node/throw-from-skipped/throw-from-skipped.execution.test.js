import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"

// sourcemap will not work because testFolder !== projectFolder
// but vscode will try to resolved them against projectFolder
// see ${workspaceFolder}/.vscode/launch.json#sourceMapPathOverrides['/*']
// someday I should retry to use relative sourcemap and make them work
// with both vscode and browsers
const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `throw-from-skipped.js`
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
