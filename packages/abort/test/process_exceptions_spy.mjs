/*
 * It's not a signal, it's something meant to be used during unit tests
 * to ensure some or no exceptions occurs when process is about to exit
 *
 * import { spyProcessExceptions } from 'somewhere'
 *
 * const getProcessExceptions = spyProcessExceptions()
 * process.once('exit', () => {
 *   const exceptions = getProcessExceptions()
 * })
 *
 * By default the event listeners are uninstalled by a "cleanup" function.
 * It's not mandatory but it's a good practice to leave things clean.
 * It's still possible to re-spy the process exceptions
 * by re-installing spy after calling getProcessExceptions()
 * but I haven't found a use case
 *
 * import { spyProcessExceptions } from 'somewhere'
 *
 * let getProcessExceptions = spyProcessExceptions()
 * // do stuff
 * const exceptions = getProcessExceptions()
 * assert(exceptions.length === 1)
 * getProcessExceptions = spyProcessExceptions()
 * // do something else
 * const newExceptions = getProcessExceptions()
 * assert(newExceptions.length === 0)
 *
 */

export const spyProcessExceptions = () => {
  let exceptions = []

  const unhandledRejectionEventCallback = (unhandledRejection, promise) => {
    exceptions = [
      ...exceptions,
      { origin: "unhandledRejection", exception: unhandledRejection, promise },
    ]
  }

  const rejectionHandledEventCallback = (promise) => {
    exceptions = exceptions.filter((exception) => exception.promise !== promise)
  }

  const uncaughtExceptionEventCallback = (uncaughtException, origin) => {
    // since node 12.4 https://nodejs.org/docs/latest-v12.x/api/process.html#process_event_uncaughtexception
    if (origin === "unhandledRejection") return

    exceptions = [
      ...exceptions,
      { origin: "uncaughtException", exception: uncaughtException },
    ]
  }

  process.on("unhandledRejection", unhandledRejectionEventCallback)
  process.on("rejectionHandled", rejectionHandledEventCallback)
  process.on("uncaughtException", uncaughtExceptionEventCallback)

  return () => {
    process.removeListener(
      "unhandledRejection",
      unhandledRejectionEventCallback,
    )
    process.removeListener("rejectionHandled", rejectionHandledEventCallback)
    process.removeListener("uncaughtException", uncaughtExceptionEventCallback)
    const exceptionsArrayCopy = exceptions.slice()
    exceptions = null
    return exceptionsArrayCopy
  }
}
