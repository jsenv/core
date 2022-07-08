import { assert } from "@jsenv/assert"

import { execute, nodeProcess } from "@jsenv/core"

const getLogs = async (params) => {
  const result = await execute({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./", import.meta.url),
    runtime: nodeProcess,
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
  const expected = `
✔ execution 1 of 1 completed (all completed)
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
{
  const actual = await getLogs({
    fileRelativeUrl: "./test_node.js",
  })
  const expected = `
✔ execution 1 of 1 completed (all completed)
file: client/main.html
-------- console (✖ 6) --------
✖ toto
✖ hey
✖ hey
  ho
  info
✖ test
multiline
  verbose log
  la
-------------------------
    
`
  assert({ actual, expected })
}
