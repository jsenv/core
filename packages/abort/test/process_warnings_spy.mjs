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

export const spyProcessWarnings = () => {
  let warnings = []

  const processWarningEventCallback = (warning) => {
    warnings.push(warning)
  }

  process.on("warning", processWarningEventCallback)

  return () => {
    process.removeListener("warning", processWarningEventCallback)
    const warningsCopy = warnings.slice()
    warnings = null
    return warningsCopy
  }
}
