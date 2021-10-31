import { raceCallbacks } from "./callback_race.js"
import { createCleaner } from "./cleaner.js"

export const createOperation = ({
  abortSignal = new AbortController().signal,
  cleanOnAbort = false,
} = {}) => {
  const cleaner = createCleaner()
  const operation = { abortSignal, cleaner }

  if (cleanOnAbort) {
    raceCallbacks(
      {
        aborted: (cb) => {
          operation.abortSignal.addEventListener("abort", cb)
          return () => {
            operation.abortSignal.removeEventListener("abort", cb)
          }
        },
        cleaned: (cb) => {
          return cleaner.addCallback(cb)
        },
      },
      (winner) => {
        const raceEffects = {
          aborted: () => {
            cleaner.clean()
          },
          cleaned: () => {},
        }
        raceEffects[winner.name]()
      },
    )
  }

  return operation
}
