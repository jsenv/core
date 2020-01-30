import { isCancelError } from "@jsenv/cancellation"

export const wrapAsyncFunction = (asyncFunction, { updateProcessExitCode = true } = {}) => {
  return asyncFunction().catch((error) => {
    if (isCancelError(error)) {
      // it means consume of the function will resolve with a cancelError
      // but when you cancel it means you're not interested in the result anymore
      // thanks to this it avoid unhandledRejection
      return error
    }

    // this is required to ensure unhandledRejection will still
    // set process.exitCode to 1 marking the process execution as errored
    // preventing further command to run
    if (updateProcessExitCode) {
      process.exitCode = 1
    }

    throw error
  })
}
