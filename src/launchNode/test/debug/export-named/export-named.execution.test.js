import { assert } from "/node_modules/@dmail/assert/index.js"
import { projectFolder } from "../../../../../projectFolder.js"
import { launchAndExecute } from "../../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../../server-compile/index.js"
import { launchNode } from "../../../launchNode.js"

const transformAsyncToPromises = import.meta.require("babel-plugin-transform-async-to-promises")

const testFolder = projectFolder
// for debugging I need filenameRelative
// to be relative to projectFolder so that vscode
// knows where sourcefiles are
const filenameRelative = `src/launchNode/test/debug/export-named/export-named.js`
const compileInto = ".dist"
const babelConfigMap = {
  "transform-block-scoping": [],
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
    verbose: true,
  })
  const expected = {
    status: "completed",
  }
  assert({ actual, expected })
})()
