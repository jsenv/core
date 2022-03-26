import { assert } from "@jsenv/assert"

import { nodeProcess } from "@jsenv/core"
import { run } from "@jsenv/core/src/execute/run.js"

const result = await run({
  // logLevel: "debug",
  runtime: nodeProcess,
  runtimeParams: {
    fileUrl: new URL("./file.js", import.meta.url),
  },
  mirrorConsole: false,
})
const actual = result
const expected = {
  status: "completed",
  namespace: {},
  duration: assert.any(Number),
}
assert({ actual, expected })
