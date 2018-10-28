import { createCancel } from "../cancel.js"
import assert from "assert"

const calls = []

const execute = () => {
  const { addCancelCallback, cancellable } = createCancel()

  calls.push("body")
  addCancelCallback(() => {
    calls.push("cleanup")
  })

  return cancellable(
    Promise.resolve().then(() => {
      calls.push("done")
    }),
  )
}

const nestedExecute = () => {
  const { addCancelCallback, cancellable } = createCancel()

  calls.push("body-nested")
  addCancelCallback(() => {
    calls.push("cleanup-nested")
  })
  return cancellable(
    Promise.resolve().then(() => {
      calls.push("done-nested")
    }),
  )
}

const { cancellable } = createCancel()

const execution = cancellable(execute()).then(() => {
  const nestedExecution = cancellable(nestedExecute())

  execution.cancel().then(() => {
    const actual = calls
    const expected = ["body", "done", "body-nested", "done-nested", "cleanup-nested", "cleanup"]
    assert.deepEqual(actual, expected)
    console.log("passed")
  })

  execution.then(() => {
    assert.fail("must not be called")
  })

  return nestedExecution
})
