import { arrayWithoutIndex } from "./arrayHelper.js"
import assert from "assert"

export const expectZeroUnhandledRejection = () => {
  let unhandledRejections = []
  let unhandledPromises = []

  process.on("unhandledRejection", (error, promise) => {
    unhandledRejections = [...unhandledRejections, error]
    unhandledPromises = [...unhandledPromises, promise]
  })
  process.on("rejectionHandled", (promise) => {
    const promiseIndex = unhandledPromises.indexOf(promise)
    if (promiseIndex === -1) return

    unhandledRejections = arrayWithoutIndex(unhandledRejections, promiseIndex)
    unhandledPromises = arrayWithoutIndex(unhandledPromises, promiseIndex)
  })

  process.on("exit", () => {
    if (process.exitCode === 0 || process.exitCode === undefined) {
      assert.deepEqual(unhandledRejections, [], "unexpected unhandled rejection")
    }
  })
}
