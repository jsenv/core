import { createCancel } from "../cancel.js"
import assert from "assert"

const calls = []
const execute = () => {
  const { cancellable, addCancelCallback } = createCancel()

  calls.push("body")
  addCancelCallback(() => {
    calls.push("cleanup")
  })
  return cancellable(
    Promise.resolve().then((value) => {
      calls.push("done")
      return value
    }),
  )
}
const execution = execute()

execution.then(() => {
  return Promise.resolve(10).then(() => {
    calls.push("consumer-a")
  })
})
execution.then(() => {
  execution.cancel().then(() => {
    const actual = calls
    const expected = ["body", "done", "consumer-a", "cleanup"]
    assert.deepEqual(actual, expected)
    console.log("passed")
  })
})
execution.then(() => {
  assert.fail("must not be called")
})
