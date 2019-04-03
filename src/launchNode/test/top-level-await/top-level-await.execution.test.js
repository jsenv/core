import { assert } from "/node_modules/@dmail/assert/index.js"
import { launchNode } from "../../launchNode.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"

const transformAsyncToPromises = import.meta.require("babel-plugin-transform-async-to-promises")
const { projectFolder } = import.meta.require("../../../../jsenv.config.js")

const testFolder = `${projectFolder}/src/launchNode/test/top-level-await`
const filenameRelative = `top-level-await.js`
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
    compileGroupCount: 2,
  })

  const actual = await launchAndExecute({
    launch: (options) => launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
    collectNamespace: true,
    filenameRelative,
    verbose: true,
    mirrorConsole: true,
  })
  const expected = {
    status: "completed",
    namespace: {
      default: 10,
    },
  }
  assert({ actual, expected })
})()
