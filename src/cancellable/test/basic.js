import { cancellable } from "../cancellable.js"
import assert from "assert"

const calls = []

const execute = () => {
  const { cancellableStep, addCancelCallback } = cancellable()

  calls.push("body")
  addCancelCallback(() => {
    calls.push("cleanup")
  })
  return cancellableStep(
    Promise.resolve().then((value) => {
      calls.push("done")
      return value
    }),
  )
}

const execution = execute()

execution.cancel().then(() => {
  const actual = calls
  const expected = ["body", "done", "cleanup"]
  assert.deepEqual(actual, expected)
  console.log("passed")
})
execution.then(() => {
  assert.fail("must not be called")
})
