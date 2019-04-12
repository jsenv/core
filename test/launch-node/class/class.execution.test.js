import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"

const babelPluginTransformClasses = import.meta.require("@babel/plugin-transform-classes")

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `class.js`
const compileInto = ".dist"
const babelConfigMap = {
  "transform-classes": [babelPluginTransformClasses, {}],
}

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
  status: "completed",
}
assert({ actual, expected })
