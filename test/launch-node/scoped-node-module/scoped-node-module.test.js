import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import {
  generateImportMapForProjectNodeModules,
  startCompileServer,
  launchAndExecute,
  launchNode,
} from "../../../index.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `scoped-node-module.js`
const compileInto = ".dist"
const babelConfigMap = {}

const sourceOrigin = `file://${testFolder}`

const importMap = await generateImportMapForProjectNodeModules({ projectFolder: testFolder })

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder: testFolder,
  compileInto,
  importMap,
  babelConfigMap,
})

const actual = await launchAndExecute({
  launch: (options) => launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
  mirrorConsole: true,
  collectNamespace: true,
  filenameRelative,
  verbose: true,
})
const expected = {
  status: "completed",
  namespace: {
    foo: "scoped-foo",
  },
}
assert({ actual, expected })
