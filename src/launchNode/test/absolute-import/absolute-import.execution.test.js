import { assert } from "@dmail/assert"
import { root } from "../../../root.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchNode } from "../../launchNode.js"

const file = `src/launchNode/test/absolute-import/absolute-import.js`
const compileInto = "build"
const babelPluginDescription = {}

;(async () => {
  const { origin: remoteRoot } = await startCompileServer({
    root,
    compileInto,
    babelPluginDescription,
  })

  const actual = await launchAndExecute({
    launch: (options) => launchNode({ ...options, root, remoteRoot, compileInto }),
    file,
    collectNamespace: true,
    verbose: true,
    platformTypeForLog: "node process",
  })

  const expected = {
    status: "completed",
    namespace: {
      default: 42,
    },
    coverageMap: undefined,
  }
  assert({ actual, expected })
})()
