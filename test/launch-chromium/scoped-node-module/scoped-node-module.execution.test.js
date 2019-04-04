import { assert } from "/node_modules/@dmail/assert/index.js"
import {
  generateImportMapForProjectNodeModules,
  launchAndExecute,
  startCompileServer,
  launchChromium,
} from "../../../index.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/launch-chromium/scoped-node-module`
const filenameRelative = `scoped-node-module.js`
const compileInto = ".dist"
const babelConfigMap = {}

;(async () => {
  const sourceOrigin = `file://${testFolder}`

  const importMap = await generateImportMapForProjectNodeModules({ projectFolder: testFolder })

  const { origin: compileServerOrigin } = await startCompileServer({
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
})()
