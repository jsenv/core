import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import {
  generateImportMapForProjectNodeModules,
  launchAndExecute,
  startCompileServer,
  launchChromium,
} from "../../../index.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `scoped-node-module.js`
const compileInto = ".dist"
const babelConfigMap = {}

const sourceOrigin = `file://${testFolder}`

const importMap = await generateImportMapForProjectNodeModules({ projectFolder: testFolder })

const { origin: compileServerOrigin } = await startCompileServer({
  verbose: false,
  importMap,
  projectFolder: testFolder,
  compileInto,
  babelConfigMap,
})

const actual = await launchAndExecute({
  launch: (options) =>
    launchChromium({
      ...options,
      compileInto,
      sourceOrigin,
      compileServerOrigin,
      headless: false,
    }),
  stopOnceExecuted: true,
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
