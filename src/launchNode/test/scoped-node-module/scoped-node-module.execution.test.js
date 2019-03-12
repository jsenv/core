import { assert } from "@dmail/assert"
import { projectFolder as selfProjectFolder } from "../../../../projectFolder.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchNode } from "../../launchNode.js"
import { generateImportMapForProjectNodeModules } from "../../../import-map/generateImportMapForProjectNodeModules.js"

const projectFolder = `${selfProjectFolder}/src/launchNode/test/scoped-node-module`
const filenameRelative = `scoped-node-module.js`
const compileInto = "build"
const babelPluginDescription = {}

;(async () => {
  const sourceOrigin = `file://${projectFolder}`

  const importMap = await generateImportMapForProjectNodeModules({ projectFolder })

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder,
    compileInto,
    importMap,
    babelPluginDescription,
  })

  const actual = await launchAndExecute({
    launch: (options) => launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
    mirrorConsole: true,
    collectNamespace: true,
    filenameRelative,
    verbose: true,
    platformTypeForLog: "node process",
  })
  const expected = {
    status: "completed",
    namespace: {
      foo: "scoped-foo",
    },
  }
  assert({ actual, expected })
})()
