import { assert } from "@jsenv/assert"

import { execute, nodeWorkerThread } from "@jsenv/core"

const result = await execute({
  rootDirectoryUrl: new URL("./", import.meta.url),
  fileRelativeUrl: `./file.js`,
  // logLevel: "debug",
  runtime: nodeWorkerThread,
  mirrorConsole: false,
  keepRunning: true, // node will naturally exit
})
const actual = result
const expected = {
  status: "completed",
  namespace: {},
  duration: assert.any(Number),
}
assert({ actual, expected })
