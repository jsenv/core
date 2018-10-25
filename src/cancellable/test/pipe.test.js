import { createCancellable } from "../index.js"
import assert from "assert"

const calls = []
const cancellable = createCancellable()

cancellable
  .map(
    Promise.resolve().then(() => {
      calls.push("job-done")
      return {
        cancel: () => {
          calls.push("cancelling")
        },
      }
    }),
  )
  .cancel()
  .then(() => {
    const actual = calls
    const expected = ["job-done", "cancelling"]
    assert.deepEqual(actual, expected)
    console.log("passed")
  })
