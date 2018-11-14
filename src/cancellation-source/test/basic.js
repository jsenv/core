import { createCancel } from "../cancel.js"
import assert from "assert"

const calls = []

const execute = async (cancellation) => {
  await cancellation.toPromise()

  calls.push("body")
  cancellation.register(() => {
    calls.push("cleanup")
  })
  return Promise.resolve().then((value) => {
    calls.push("done")
    return value
  })
}

const { cancel, cancellation } = createCancel()
const execution = execute(cancellation)

new Promise((resolve) => {
  setTimeout(resolve, 1)
}).then(() => {
  cancel().then(() => {
    const actual = calls
    const expected = ["body", "done", "cleanup"]
    assert.deepEqual(actual, expected)
    console.log("passed")
  })
  execution.then(() => {
    // assert.fail("must not be called")
  })
})
