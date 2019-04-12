import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `not-found.js`
const compileInto = ".dist"
const babelConfigMap = {}

const sourceOrigin = `file://${testFolder}`

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder: testFolder,
  compileInto,
  babelConfigMap,
})

const actual = await launchAndExecute({
  launch: (options) => launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
  filenameRelative,
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
