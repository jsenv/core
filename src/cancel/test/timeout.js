import { createCancel } from "../cancel.js"
import assert from "assert"

const calls = []
const execute = (cancellation) => {
  setTimeout(() => {
    cancellation.wrap((register) => {
      calls.push("50")
      register(() => {
        calls.push("50-cleanup")
      })
    })
  }, 50)
  setTimeout(() => {
    cancellation.wrap((register) => {
      assert.fail("must not be called")
      calls.push("150")
      register(() => {
        calls.push("150-cleanup")
      })
    })
  }, 150)
}

const { cancel, cancellation } = createCancel()
execute(cancellation)

setTimeout(() => {
  cancel().then(() => {
    const actual = calls
    const expected = ["50", "50-cleanup"]
    assert.deepEqual(actual, expected)
    console.log("passed")
  })
}, 100)
