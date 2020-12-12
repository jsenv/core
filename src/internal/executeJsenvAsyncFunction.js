import { executeAsyncFunction } from "@jsenv/cancellation"

export const executeJsenvAsyncFunction = (fn) =>
  executeAsyncFunction(fn, {
    catchCancellation: true,
    considerUnhandledRejectionsAsExceptions: true,
  })
