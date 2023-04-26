/*
 * to enable/disable color process.env.FORCE_COLOR is used.
 * It is documented in https://nodejs.org/api/tty.html#tty_writestream_getcolordepth_env
 */

import { assert } from "@jsenv/assert"

import { execute, nodeWorkerThread } from "@jsenv/test"

const getLogs = async () => {
  const result = await execute({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./", import.meta.url),
    runtime: nodeWorkerThread(),
    fileRelativeUrl: "./project/execute_test_plan.js",
    collectConsole: true,
    mirrorConsole: false,
  })
  const logs = result.consoleCalls.reduce((previous, { type, text }) => {
    if (type !== "log") {
      return previous
    }
    return `${previous}${text}`
  }, "")
  return logs
}

if (process.platform !== "win32") {
  // execution with colors disabled
  {
    process.env.FORCE_COLOR = "false"
    const actual = await getLogs()
    const expected = `✔ execution 1 of 1 completed (all completed)
file: file.js
runtime: node_worker_thread/${process.version.slice(1)}

`
    assert({ actual, expected })
  }

  // execution with colors enabled
  {
    process.env.FORCE_COLOR = "true"
    const actual = await getLogs()
    const expected = `[32m✔ execution 1 of 1 completed[0m (all [32mcompleted[0m)
file: file.js
runtime: node_worker_thread/${process.version.slice(1)}

`
    assert({ actual, expected })
  }
}
