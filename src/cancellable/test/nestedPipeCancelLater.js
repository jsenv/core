import { createCancellable } from "../index.js"
import assert from "assert"

const calls = []
const cancellable = createCancellable()

const createNestedCancellable = () => {
  const cancellable = createCancellable()
  return cancellable.map(
    Promise.resolve().then(() => {
      cancellable.addCancellingTask(() => {
        calls.push("cancelling-nested")
      })
      return "nested"
    }),
  )
}

const promise = cancellable.map(
  Promise.resolve().then(() => {
    return new Promise((resolve) => {
      setTimeout(resolve, 10, "foo")
    }).then(() => {
      calls.push("heres")
      cancellable.addCancellingTask(() => {
        calls.push("cancelling")
      })
      return createNestedCancellable()
    })
  }),
)

promise.then(() => {
  debugger
  promise.cancel().then(() => {
    const actual = calls
    const expected = ["cancelling"]
    assert.deepEqual(actual, expected)
    console.log("passed")
  })
})
