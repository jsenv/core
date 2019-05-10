import { arrayWithout } from "@dmail/helper"

export const registerProcessExitErrorHandler = (callback) => {
  let unhandledRejections = []

  process.on("unhandledRejection", (error, promise) => {
    unhandledRejections = [...unhandledRejections, { error, promise }]
  })
  process.on("rejectionHandled", (promise) => {
    unhandledRejections = arrayWithout(
      unhandledRejections,
      (unhandledRejection) => unhandledRejection.promise === promise,
    )
  })
  const uncaughtExceptionArray = []
  process.on("uncaughtException", (error) => {
    uncaughtExceptionArray.push(error)
  })

  process.on("exit", () => {
    if (process.exitCode === 0 || process.exitCode === undefined) {
      callback({
        uncaughtExceptionArray,
        unhandledRejectionArray: unhandledRejections.map(({ error }) => error),
      })
    }
  })
}
