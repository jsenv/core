import { assert } from "/node_modules/@dmail/assert/index.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/src/launchNode/test/not-found`
const filenameRelative = `not-found.js`
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
    launch: (options) => launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
    mirrorConsole: true,
    filenameRelative,
    verbose: true,
  })
  const expected = {
    status: "errored",
    error: {
      stack: actual.error.stack,
      message: `file not found.
file: foo.js
importerFile: not-found.js`,
      file: "foo.js",
      importerFile: "not-found.js",
      code: "MODULE_NOT_FOUND_ERROR",
    },
  }
  assert({ actual, expected })
})()
