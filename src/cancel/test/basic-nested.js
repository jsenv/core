import { createCancel } from "../cancel.js"
import assert from "assert"

const calls = []

const execute = (cancellation) => {
  calls.push("body")
  cancellation.register(() => {
    calls.push("cleanup")
  })

  return cancellation.wrap(() => {
    return Promise.resolve().then(() => {
      calls.push("done")
    })
  })
}

const nestedExecute = (cancellation) => {
  calls.push("body-nested")
  cancellation.register(() => {
    calls.push("cleanup-nested")
  })
  return cancellation.wrap(() => {
    return Promise.resolve().then(() => {
      calls.push("done-nested")
    })
  })
}

const { cancellation, cancel } = createCancel()

const execution = execute(cancellation).then(() => {
  const nestedExecution = nestedExecute(cancellation)

  cancel().then(() => {
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
