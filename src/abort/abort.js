import * as abortPolyfill from "./abort_controller_polyfill.js"

if (typeof global.AbortController !== "function") {
  global.AbortController = abortPolyfill.AbortController
  global.AbortSignal = abortPolyfill.AbortSignal
}

export const Abort = {
  dormantSignal: () => {
    return dormantSignal
  },

  throwIfAborted: (abortSignal) => {
    if (abortSignal.aborted) {
      const error = new Error(`The operation was aborted.`)
      error.name = "AbortError"
      error.type = "aborted"

      throw error
    }
  },

  composeTwoAbortSignals: (firstAbortSignal, secondAbortSignal) => {
    if (firstAbortSignal.aborted) {
      return firstAbortSignal
    }
    if (secondAbortSignal.aborted) {
      return secondAbortSignal
    }

    const abortController = new AbortController()

    const abortEventCallback = () => {
      firstAbortSignal.removeEventListener("abort", abortEventCallback)
      secondAbortSignal.removeEventListener("abort", abortEventCallback)
      abortController.abort()
    }
    firstAbortSignal.addEventListener("abort", abortEventCallback)
    secondAbortSignal.addEventListener("abort", abortEventCallback)

    return abortController.signal
  },
}

const dormantAbortController = new AbortController()
const dormantSignal = dormantAbortController.signal
