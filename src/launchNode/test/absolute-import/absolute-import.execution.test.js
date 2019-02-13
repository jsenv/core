import { assert } from "@dmail/assert"
import { filenameToFileHref } from "@jsenv/module-resolution"
import { projectFolder } from "../../../projectFolder.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchNode } from "../../launchNode.js"

const filenameRelative = `src/launchNode/test/absolute-import/absolute-import.js`
const compileInto = "build"
const babelPluginDescription = {}

;(async () => {
  const sourceOrigin = filenameToFileHref(projectFolder)

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
      default: 42,
    },
  }
  assert({ actual, expected })
})()
