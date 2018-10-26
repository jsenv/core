import { cancellable } from "../cancellable.js"
import assert from "assert"

const calls = []
const execution = cancellable((cleanup) => {
  calls.push("body")
  cleanup(() => {
    calls.push("cleanup")
  })

  return Promise.resolve().then((value) => {
    calls.push("done")
    return value
  })
})

execution.cancel().then(() => {
  const actual = calls
  const expected = ["body", "done", "cleanup"]
  assert.deepEqual(actual, expected)
  console.log("passed")
})
execution.then(() => {
  assert.fail("must not be called")
})
