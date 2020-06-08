import { wrapExternalFunction } from "@jsenv/util"

export const wrapExternalFunctionExecution = (fn) =>
  wrapExternalFunction(fn, { catchCancellation: true, unhandledRejectionStrict: true })
