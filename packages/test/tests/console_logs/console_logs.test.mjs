import { assert } from "@jsenv/assert"

import { execute, nodeWorkerThread } from "@jsenv/test"

process.env.FORCE_COLOR = "false"
const getLogs = async (params) => {
  const result = await execute({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./", import.meta.url),
    runtime: nodeWorkerThread(),
    collectConsole: true,
    mirrorConsole: false,
    ...params,
  })
  const logs = result.consoleCalls.reduce((previous, { type, text }) => {
    if (type !== "log") {
      return previous
    }
    return `${previous}${text}`
  }, "")
  return logs
}

// on browsers
{
  const actual = await getLogs({
    fileRelativeUrl: "./test_browser.js",
  })
  const expected = `✔ execution 1 of 1 completed (all completed)
file: client/main.html
-------- console (✖ 1 ⚠ 3 ℹ 1 ◆ 1) --------
⚠ toto
✖ hey
⚠ hey
  ho
ℹ info
⚠ test
  multiline
◆ verbose log
  la
-------------------------

`
  assert({ actual, expected })
}

// on node
if (process.platform !== "win32") {
  const actual = await getLogs({
    fileRelativeUrl: "./test_node.js",
  })
  const expected = `✔ execution 1 of 1 completed (all completed)
file: client/main.js
-------- console (✖ 4) --------
✖ toto
  ho
✖ hey
✖ hey
✖ test
  multiline
  info
  verbose log
  la
-------------------------

`
  assert({ actual, expected })
}
