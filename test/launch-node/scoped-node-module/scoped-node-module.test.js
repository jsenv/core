import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { fileWrite } from "@dmail/helper"
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
await fileWrite(`${testFolder}/importMap.json`, JSON.stringify(importMap, null, "  "))

const { origin: compileServerOrigin } = await startCompileServer({
  verbose: false,
  projectFolder: testFolder,
  compileInto,
  babelConfigMap,
})

const actual = await launchAndExecute({
  launch: (options) => launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
  collectNamespace: true,
  filenameRelative,
  verbose: false,
})
const expected = {
  status: "completed",
  namespace: {
    foo: "scoped-foo",
  },
}
assert({ actual, expected })
