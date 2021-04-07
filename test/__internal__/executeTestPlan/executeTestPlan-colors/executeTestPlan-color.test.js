/**

to enable/disable color process.env.FORCE_COLOR is used.
It is documented in https://nodejs.org/api/tty.html#tty_writestream_getcolordepth_env

*/

import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { launchAndExecute } from "@jsenv/core/src/internal/executing/launchAndExecute.js"
import { launchNode } from "@jsenv/core"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  LAUNCH_AND_EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_NODE.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativePath}.jsenv/`
const filename = `execute-test-plan.js`
const fileRelativeUrl = `${testDirectoryRelativePath}${filename}`
const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})

const getLogs = async () => {
  const result = await launchAndExecute({
    ...LAUNCH_AND_EXECUTE_TEST_PARAMS,
    fileRelativeUrl,
    launch: (options) =>
      launchNode({
        ...LAUNCH_TEST_PARAMS,
        ...options,
        outDirectoryRelativeUrl,
        compileServerOrigin,
      }),
    captureConsole: true,
    // mirrorConsole: false
  })

  const logs = result.consoleCalls.reduce((previous, { type, text }) => {
    if (type !== "log") {
      return previous
    }
    return `${previous}${text}`
  }, "")
  return logs
}

// execution with colors enabled
if (process.platform !== "win32") {
  process.env.FORCE_COLOR = 1
  const actual = await getLogs()
  const expected = `
[32m✔ execution 1 of 1 completed[0m (all [32mcompleted[0m).
file: ${testDirectoryRelativePath}file.js
runtime: node/${process.version.slice(1)}

-------------- summary -----------------
1 execution: all [32mcompleted[0m.
----------------------------------------

`
  assert({ actual, expected })
}

// execution with colors disabled
if (process.platform !== "win32") {
  process.env.FORCE_COLOR = 0
  const actual = await getLogs()
  const expected = `
✔ execution 1 of 1 completed (all completed).
file: ${testDirectoryRelativePath}file.js
runtime: node/${process.version.slice(1)}

-------------- summary -----------------
1 execution: all completed.
----------------------------------------

`
  assert({ actual, expected })
}
