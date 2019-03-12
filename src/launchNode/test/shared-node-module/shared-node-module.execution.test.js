import { assert } from "@dmail/assert"
import { projectFolder } from "../../../projectFolder.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchNode } from "../../launchNode.js"

const filenameRelative = `src/launchNode/test/shared-node-module/shared-node-module.js`
const compileInto = "build"
const babelPluginDescription = {}

;(async () => {
  const sourceOrigin = `file://${projectFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder,
    compileInto,
    babelPluginDescription,
  })

  const actual = await launchAndExecute({
    launch: (options) => launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
    collectNamespace: true,
    filenameRelative,
    verbose: true,
    platformTypeForLog: "node process",
  })
  const expected = {
    status: "completed",
    namespace: {
      foo: "foo",
    },
  }
  assert({ actual, expected })
})()
