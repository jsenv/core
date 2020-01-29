import { isCancelError } from "@jsenv/cancellation"

export const wrapAsyncFunction = (asyncFunction, { updateProcessExitCode = true } = {}) => {
  return asyncFunction().catch((error) => {
    if (isCancelError(error)) return

    // this is required to ensure unhandledRejection will still
    // set process.exitCode to 1 preventing further command to run
    if (updateProcessExitCode) {
      process.exitCode = 1
    }

    throw error
  })
}
