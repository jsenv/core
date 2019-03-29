import { assert } from "/node_modules/@dmail/assert/index.js"
import transformBlockScoping from "@babel/plugin-transform-block-scoping"
import { projectFolder } from "../../../../projectFolder.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchChromium } from "../../launchChromium.js"

const transformAsyncToPromises = import.meta.require("babel-plugin-transform-async-to-promises")

const testFolder = `${projectFolder}/src/launchChromium/test/top-level-await`
const filenameRelative = `top-level-await.js`
const compileInto = ".dist"
const babelPluginDescription = {
  "transform-async-to-promises": [transformAsyncToPromises],
  "transform-block-scoping": [transformBlockScoping],
}

;(async () => {
  const sourceOrigin = `file://${testFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder: testFolder,
    compileInto,
    babelPluginDescription,
  })

  const actual = await launchAndExecute({
    launch: (options) =>
      launchChromium({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
    stopOnceExecuted: true,
    collectNamespace: true,
    filenameRelative,
    verbose: true,
  })
  const expected = {
    status: "completed",
    namespace: {
      default: 10,
    },
  }
  assert({ actual, expected })
})()
