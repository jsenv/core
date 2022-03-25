import { assert } from "@jsenv/assert"

import { execute, nodeProcess } from "@jsenv/core"

const result = await execute({
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
