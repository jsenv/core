import { createCancellable } from "../index.js"
import assert from "assert"

const calls = []
const cancellable = createCancellable()

const promise = cancellable.map(
  new Promise((resolve) => {
    setTimeout(() => {
      calls.push("resolve")
      cancellable.addCancellingTask(() => {
        calls.push("cancelling")
      })
      resolve({
        cancel: () => {
          cancellable.addCancellingTask(() => {
            calls.push("cancelling-late")
          })
          calls.push("cancelling-pipe")
        },
      })
    }, 10)
  }),
)

promise.then(() => {
  assert.fail("must not be called")
})

promise.then(() => {
  assert.fail("must not be called")
})

promise.cancel().then(() => {
  const actual = calls
  const expected = ["resolve", "cancelling-pipe", "cancelling"]
  assert.deepEqual(actual, expected)
  console.log("passed")
})
