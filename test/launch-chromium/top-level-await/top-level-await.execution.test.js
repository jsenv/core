import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"

const transformBlockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const transformAsyncToPromises = import.meta.require("babel-plugin-transform-async-to-promises")

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `top-level-await.js`
const compileInto = ".dist"
const babelConfigMap = {
  "transform-async-to-promises": [transformAsyncToPromises],
  "transform-block-scoping": [transformBlockScoping],
}

const sourceOrigin = `file://${testFolder}`

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder: testFolder,
  compileInto,
  babelConfigMap,
})

const actual = await launchAndExecute({
  launch: (options) =>
    launchChromium({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
  stopOnceExecuted: true,
  collectNamespace: true,
  filenameRelative,
})
const expected = {
  status: "completed",
  namespace: {
    default: 10,
  },
}
assert({ actual, expected })
