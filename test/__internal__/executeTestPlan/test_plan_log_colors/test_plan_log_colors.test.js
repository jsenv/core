/**

to enable/disable color process.env.FORCE_COLOR is used.
It is documented in https://nodejs.org/api/tty.html#tty_writestream_getcolordepth_env

*/

import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { execute, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_NODE.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativePath}.jsenv/`
const filename = `./project/execute_test_plan.js`
const fileRelativeUrl = `${testDirectoryRelativePath}${filename}`

const getLogs = async () => {
  const result = await execute({
    ...EXECUTE_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    runtime: nodeRuntime,
    runtimeParams: {
      ...LAUNCH_TEST_PARAMS,
    },
    fileRelativeUrl,
    captureConsole: true,
    stopAfterExecute: true,
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

// execution with colors disabled
if (process.platform !== "win32") {
  process.env.FORCE_COLOR = "false"
  const actual = await getLogs()
  const expected = `
✔ execution 1 of 1 completed (all completed)
file: ${testDirectoryRelativePath}project/file.js
runtime: node/${process.version.slice(1)}

-------------- summary -----------------
1 execution: all completed
----------------------------------------

`
  assert({ actual, expected })
}

// execution with colors enabled
if (process.platform !== "win32") {
  process.env.FORCE_COLOR = "true"
  const actual = await getLogs()
  const expected = `
[32m✔ execution 1 of 1 completed[39m (all [32mcompleted[39m)
file: ${testDirectoryRelativePath}project/file.js
runtime: node/${process.version.slice(1)}

-------------- summary -----------------
1 execution: all [32mcompleted[39m
----------------------------------------

`
  assert({ actual, expected })
}
