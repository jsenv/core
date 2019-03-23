import { assert } from "@dmail/assert"
import { root } from "../../../root.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchNode } from "../../launchNode.js"

const file = `src/launchNode/test/not-found/not-found.js`
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
    status: "errored",
    error: {
      code: "MODULE_NOT_FOUND_ERROR",
      message: `src/launchNode/test/not-found/foo.js not found`,
      stack: actual.error.stack,
      url: `${remoteRoot}/${compileInto}/best/src/launchNode/test/not-found/foo.js`,
    },
  }
  assert({ actual, expected })
})()
