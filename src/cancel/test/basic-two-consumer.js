import { createCancel } from "../cancel.js"
import assert from "assert"

const calls = []
const execute = (cancellation) => {
  calls.push("body")

  return cancellation.wrap((register) => {
    register(() => {
      calls.push("cleanup")
    })
    return Promise.resolve().then((value) => {
      calls.push("done")
      return value
    })
  })
}

const { cancellation, cancel } = createCancel()
const execution = execute(cancellation)

execution.then(() => {
  return Promise.resolve(10).then(() => {
    calls.push("consumer-a")
  })
})
execution.then(() => {
  cancel().then(() => {
    const actual = calls
    const expected = ["body", "done", "consumer-a", "cleanup"]
    assert.deepEqual(actual, expected)
    console.log("passed")
  })
})
execution.then(() => {
  assert.fail("must not be called")
})
