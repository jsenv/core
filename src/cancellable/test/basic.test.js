import { createCancellable } from "../index.js"
import assert from "assert"

const calls = []
const cancellable = createCancellable()

cancellable
  .map(
    Promise.resolve().then(() => {
      cancellable.addCancellingTask(() => {
        calls.push("cancelling-start")
        return Promise.resolve().then(() => {
          calls.push("cancelling-end")
        })
      })
      calls.push("job-done")
    }),
  )
  .cancel()
  .then(() => {
    const actual = calls
    const expected = ["job-done", "cancelling-start", "cancelling-end"]
    assert.deepEqual(actual, expected)
    console.log("passed")
  })
