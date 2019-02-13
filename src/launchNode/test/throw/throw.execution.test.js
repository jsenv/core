import { assert } from "@dmail/assert"
import { root } from "../../../root.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchNode } from "../../launchNode.js"
import { removeDebuggerLog } from "../removeDebuggerLog.js"

const file = `src/launchNode/test/throw/throw.js`
const compileInto = "build"
const babelPluginDescription = {}

;(async () => {
  const { origin: remoteRoot } = await startCompileServer({
    root,
    compileInto,
    babelPluginDescription,
  })

  const actual = await launchAndExecute({
    launch: (options) => launchNode({ ...options, root, compileInto, remoteRoot }),
    captureConsole: true,
    verbose: true,
    platformTypeForLog: "node process",
    file,
  })
  actual.platformLog = removeDebuggerLog(actual.platformLog)
  const expected = {
    status: "errored",
    error: {
      stack: actual.error.stack,
      message: "error",
    },
    platformLog: `${actual.error.stack}
`,
  }
  assert({ actual, expected })
})()
