import { assert } from "@dmail/assert"
import { root } from "../../../root.js"
import { launchNode } from "../../launchNode.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"

const file = `src/launchNode/test/alive/alive.js`
const compileInto = ".dist"
const babelPluginDescription = {}

;(async () => {
  const { origin: remoteRoot } = await startCompileServer({
    root,
    compileInto,
    babelPluginDescription,
  })

  const actual = await launchAndExecute({
    launch: (options) => launchNode({ ...options, root, compileInto, remoteRoot }),
    mirrorConsole: true,
    file,
    verbose: true,
  })
  const expected = {
    status: "completed",
  }
  assert({ actual, expected })
})()
