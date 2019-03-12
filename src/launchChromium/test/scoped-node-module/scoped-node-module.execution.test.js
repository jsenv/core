import { assert } from "@dmail/assert"
import { projectFolder as selfProjectFolder } from "../../../../projectFolder.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { launchChromium } from "../../launchChromium.js"
import { generateImportMapForProjectNodeModules } from "../../../import-map/generateImportMapForProjectNodeModules.js"

const projectFolder = `${selfProjectFolder}/src/launchChromium/test/scoped-node-module`
const filenameRelative = `scoped-node-module.js`
const compileInto = "build"
const babelPluginDescription = {}

;(async () => {
  const sourceOrigin = `file://${projectFolder}`

  const importMap = await generateImportMapForProjectNodeModules({ projectFolder })

  const { origin: compileServerOrigin } = await startCompileServer({
    importMap,
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
    platformTypeForLog: "chromium browser",
  })
  const expected = {
    status: "completed",
    namespace: {
      foo: "scoped-foo",
    },
  }
  assert({ actual, expected })
})()
