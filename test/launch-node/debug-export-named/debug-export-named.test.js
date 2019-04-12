import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"

const transformAsyncToPromises = import.meta.require("babel-plugin-transform-async-to-promises")

// sourcemap will not work because testFolder !== projectFolder
// but vscode will try to resolved them against projectFolder
// see ${workspaceFolder}/.vscode/launch.json#sourceMapPathOverrides['/*']
// someday I should retry to use relative sourcemap and make them work
// with both vscode and browsers
const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `debug-export-named.js`
const compileInto = ".dist"
const babelConfigMap = {
  "transform-async-to-promises": [transformAsyncToPromises],
}

;(async () => {
  const sourceOrigin = `file://${testFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder: testFolder,
    compileInto,
    babelConfigMap,
  })

  const actual = await launchAndExecute({
    launch: (options) => launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
    filenameRelative,
    mirrorConsole: true,
    verbose: true,
  })
  const expected = {
    status: "completed",
  }
  assert({ actual, expected })
})()
