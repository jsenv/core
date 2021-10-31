import { Abort } from "./abort.js"
import { raceProcessTeardownEvents } from "./process_teardown_events.js"

export const abortOperationOnProcessTeardown = (
  operation,
  processTeardownEvents,
) => {
  const processSignalAbortController = new AbortController()
  operation.abortSignal = Abort.composeTwoAbortSignals(
    operation.abortSignal,
    processSignalAbortController.signal,
  )
  const cleanupProcessTeardownRace = raceProcessTeardownEvents(
    processTeardownEvents,
    () => {
      processSignalAbortController.abort()
    },
  )
  const removeCleanCallback = operation.cleaner.addCallback(() => {
    cleanupProcessTeardownRace()
  })
  return () => {
    cleanupProcessTeardownRace()
    removeCleanCallback()
  }
}
