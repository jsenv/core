import { createCancel } from "../cancel.js"
import assert from "assert"

const calls = []

const execute = (cancellation) => {
  return cancellation.wrap((register) => {
    calls.push("body")
    register(() => {
      calls.push("cleanup")
    })
    return Promise.resolve().then((value) => {
      calls.push("done")
      return value
    })
  })
}

const { cancel, cancellation } = createCancel()
const execution = execute(cancellation)

cancel().then(() => {
  const actual = calls
  const expected = ["body", "done", "cleanup"]
  assert.deepEqual(actual, expected)
  console.log("passed")
})
execution.then(() => {
  assert.fail("must not be called")
})
