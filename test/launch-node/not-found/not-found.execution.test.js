import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `not-found.js`
const compileInto = ".dist"
const babelConfigMap = {}

const sourceOrigin = `file://${testFolder}`

const { origin: compileServerOrigin } = await startCompileServer({
  verbose: false,
  projectFolder: testFolder,
  compileInto,
  babelConfigMap,
})

const actual = await launchAndExecute({
  launch: (options) => launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
  filenameRelative,
  verbose: false,
})
const expected = {
  status: "errored",
  error: {
    stack: actual.error.stack,
    message: `module not found.
href: ${compileServerOrigin}/${compileInto}/otherwise/foo.js
importerHref: ${compileServerOrigin}/${compileInto}/otherwise/not-found.js`,
    href: `${compileServerOrigin}/${compileInto}/otherwise/foo.js`,
    importerHref: `${compileServerOrigin}/${compileInto}/otherwise/not-found.js`,
    code: "MODULE_NOT_FOUND_ERROR",
  },
}
assert({ actual, expected })
