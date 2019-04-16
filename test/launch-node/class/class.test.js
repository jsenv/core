import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const compileInto = ".dist"
const filenameRelative = `class.js`
const sourceOrigin = `file://${testFolder}`

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder: testFolder,
  verbose: false,
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
