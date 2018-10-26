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

execution.then(() =>
  Promise.resolve(10).then(() => {
    calls.push("consumer-a")
  }),
)
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
