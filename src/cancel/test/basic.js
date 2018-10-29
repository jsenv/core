import { createCancel } from "../cancel.js"
import assert from "assert"

const calls = []

const execute = (cancellation) => {
  calls.push("body")
  cancellation.register(() => {
    calls.push("cleanup")
  })

  return cancellation.wrap(() => {
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
