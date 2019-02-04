import { assert } from "@dmail/assert"
import transformAsyncToPromises from "babel-plugin-transform-async-to-promises"
import transformModulesSystemJs from "../../../babel-plugin-transform-modules-systemjs/index.js"
import { localRoot } from "../../../localRoot.js"
import { launchNode } from "../../launchNode.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { removeDebuggerLog } from "../removeDebuggerLog.js"

const file = `src/launchNode/test/timeout/timeout.js`
const compileInto = "build"
const pluginMap = {
  "transform-modules-systemjs": [transformModulesSystemJs, { topLevelAwait: true }],
  "transform-async-to-promises": [transformAsyncToPromises],
}

;(async () => {
  const { origin: remoteRoot } = await startCompileServer({
    localRoot,
    compileInto,
    pluginMap,
  })

  const actual = await launchAndExecute(
    () => launchNode({ localRoot, remoteRoot, compileInto }),
    file,
    {
      platformTypeForLog: "node process",
      verbose: true,
      allocatedMs: 5000,
      captureConsole: true,
    },
  )
  actual.platformLog = removeDebuggerLog(actual.platformLog)
  const expected = {
    status: "timedout",
    platformLog: `foo
`,
  }
  assert({ actual, expected })
})()
