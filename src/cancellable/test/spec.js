import { createCancellable } from "../index.js"
import assert from "assert"

const calls = []
const createFirstCancellable = () => {
  const cancellable = createCancellable()

  cancellable.addCancellingTask(() => {
    calls.push("cancelling-first")
  })

  return cancellable.map(Promise.resolve("first"))
}

const createSecondCancellable = () => {
  const cancellable = createCancellable()

  cancellable.addCancellingTask(() => {
    calls.push("cancelling-second")
  })

  return cancellable.map(Promise.resolve("second"))
}

const finalPromise = createFirstCancellable().then(() => {
  debugger
  finalPromise.cancel() // je cancel ici donc lo
  return createSecondCancellable().then(() => {
    debugger
    assert.fail("must not be called")
  })
})
