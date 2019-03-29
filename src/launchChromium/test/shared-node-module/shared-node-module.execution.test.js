import { assert } from "/node_modules/@dmail/assert/index.js"
import { projectFolder as selfProjectFolder } from "../../../../projectFolder.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { launchChromium } from "../../launchChromium.js"

const projectFolder = `${selfProjectFolder}/src/launchChromium/test/shared-node-module`
const filenameRelative = `shared-node-module.js`
const compileInto = ".dist"
const babelPluginDescription = {}

;(async () => {
  const sourceOrigin = `file://${projectFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder,
    compileInto,
    babelPluginDescription,
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
    mirrorConsole: true,
    collectNamespace: true,
    filenameRelative,
    verbose: true,
  })
  const expected = {
    status: "completed",
    namespace: {
      foo: "foo",
    },
  }
  assert({ actual, expected })
})()
