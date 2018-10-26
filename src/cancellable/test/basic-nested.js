import { cancellable } from "../cancellable.js"
import assert from "assert"

const calls = []

const execution = cancellable((cleanup) => {
  calls.push("body")
  cleanup(() => {
    calls.push("cleanup")
  })
  return Promise.resolve().then(() => {
    calls.push("done")
  })
}).then(() => {
  const nested = cancellable((cleanup) => {
    calls.push("body-nested")
    cleanup(() => {
      calls.push("cleanup-nested")
    })
    return Promise.resolve().then(() => {
      calls.push("done-nested")
    })
  })

  execution.cancel().then(() => {
    const actual = calls
    const expected = ["body", "done", "body-nested", "done-nested", "cleanup-nested", "cleanup"]
    assert.deepEqual(actual, expected)
    console.log("passed")
  })

  execution.then(() => {
    assert.fail("must not be called")
  })

  return nested
})
