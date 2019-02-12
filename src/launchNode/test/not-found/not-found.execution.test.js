import { assert } from "@dmail/assert"
import { localRoot } from "../../../localRoot.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchNode } from "../../launchNode.js"

const file = `src/launchNode/test/not-found/not-found.js`
const compileInto = "build"
const pluginMap = {}

;(async () => {
  const { origin: remoteRoot } = await startCompileServer({
    localRoot,
    compileInto,
    pluginMap,
  })

  const actual = await launchAndExecute({
    launch: (options) => launchNode({ ...options, localRoot, compileInto, remoteRoot }),
    mirrorConsole: true,
    file,
    verbose: true,
    platformTypeForLog: "node process",
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
