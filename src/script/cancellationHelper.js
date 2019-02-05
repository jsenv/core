import { isCancelError, createCancellationSource } from "@dmail/cancellation"

export const catchAsyncFunctionCancellation = (asyncFunction) => {
  return asyncFunction().catch((error) => {
    if (isCancelError(error)) return
    throw error
  })
}

export const createProcessInterruptionCancellationToken = () => {
  const SIGINTCancelSource = createCancellationSource()
  process.on("SIGINT", () => SIGINTCancelSource.cancel("process interruption"))
  return SIGINTCancelSource.token
}
