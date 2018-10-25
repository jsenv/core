import { createCancellable } from "../index.js"
import assert from "assert"

const calls = []
const cancellable = createCancellable()

const promise = cancellable.map(
  Promise.resolve().then(() => {
    return new Promise((resolve) => {
      setTimeout(resolve, 10)
    }).then(() => {
      cancellable.addCancellingTask(() => {
        calls.push("cancelling")
      })
    })
  }),
)

promise.then(() => {
  assert.fail("must not be called")
})

promise.cancel().then(() => {
  const actual = calls
  const expected = ["cancelling"]
  assert.deepEqual(actual, expected)
  console.log("passed")
})
