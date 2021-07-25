import { executeAsyncFunction, createCancellationSource } from "@jsenv/cancellation"
import { SIGINTSignal } from "@jsenv/node-signals"

export const executeJsenvAsyncFunction = (fn, { cancelOnSIGINT = false } = {}) => {
  return executeAsyncFunction(
    async () => {
      const jsenvCancellationSource = createCancellationSource()
      const jsenvCancellationToken = jsenvCancellationSource.token

      if (cancelOnSIGINT) {
        const unregister = SIGINTSignal.addCallback(() => {
          jsenvCancellationSource.cancel("process SIGINT")
        })
        try {
          return await fn({ jsenvCancellationToken })
        } finally {
          unregister()
        }
      }

      return fn({ jsenvCancellationToken })
    },
    {
      catchCancellation: true,
      considerUnhandledRejectionsAsExceptions: true,
    },
  )
}
