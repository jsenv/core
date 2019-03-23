import { assert } from "@dmail/assert"
import transformAsyncToPromises from "babel-plugin-transform-async-to-promises"
import { projectFolder } from "../../../../projectFolder.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchChromium } from "../../launchChromium.js"

const testFolder = `${projectFolder}/src/launchChromium/test/dynamic-import/`
const filenameRelative = `dynamic-import.js`
const compileInto = ".dist"
const babelPluginDescription = {
  "transform-async-to-promises": [transformAsyncToPromises],
}

;(async () => {
  const sourceOrigin = `file://${projectFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder: testFolder,
    compileInto,
    babelPluginDescription,
  })

  const actual = await launchAndExecute({
    launch: (options) =>
      launchChromium({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
    verbose: true,
    stopOnceExecuted: true,
    collectNamespace: true,
    filenameRelative,
  })
  const expected = {
    status: "completed",
    namespace: {
      default: 42,
    },
  }
  assert({ actual, expected })
})()
