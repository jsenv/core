/*
 * https://github.com/whatwg/dom/issues/920
 */

import { createCleaner } from "./cleaner.js"
import { raceCallbacks } from "./callback_race.js"
import { createSignal } from "./signal.js"

export const Abortable = {
  throwIfAborted: (operation) => {
    if (operation.signal.aborted) {
      const error = new Error(`The operation was aborted`)
      error.name = "AbortError"
      error.type = "aborted"
      throw error
    }
  },

  isAbortError: (error) => {
    return error.name === "AbortError"
  },

  start: () => {
    const abortController = new AbortController()
    const cleaner = createCleaner()
    const signal = abortController.signal

    // the abort Signal is used to ignore the max listeners warning from Node.js
    // this warning is usefull but when followSignal is used
    // we'll assume the signal will be correctly unfollowed later
    const abortSignal = createSignal({ once: true })
    signal.onabort = () => abortSignal.emit()

    const operation = {
      abort: (value) => abortController.abort(value),
      signal,
      abortSignal,
      cleaner,
    }

    return operation
  },

  fromSignal: (signal) => {
    const operation = Abortable.start()
    Abortable.followSignal(operation, signal)
    return operation
  },

  followSignal: (operation, signal, cleanup = cleanupNoop) => {
    if (operation.signal.aborted) {
      return () => {}
    }

    if (signal.aborted) {
      operation.abort()
      return () => {}
    }

    return raceCallbacks(
      {
        parent_abort: (cb) => {
          return operation.abortSignal.addCallback(cb)
        },
        child_abort: (cb) => {
          return addEventListener(signal, "abort", cb)
        },
        cleaned: (cb) => {
          return operation.cleaner.addCallback(cb)
        },
      },
      (winner) => {
        const raceEffects = {
          parent_abort: () => {
            // Nothing to do, exists to remove
            // - "abort" event listener on parent
            // - "abort" event listener on child
            cleanup()
          },
          child_abort: () => {
            operation.abort()
          },
          cleaned: () => {
            // Nothing to do, exists to remove
            // - "abort" event listener on parent
            // - "abort" event listener on child
            cleanup()
          },
        }
        raceEffects[winner.name](winner.value)
      },
    )
  },

  effect: (operation, effect) => {
    const abortController = new AbortController()
    const returnValue = effect((value) => abortController.abort(value))
    const cleanup =
      typeof returnValue === "function" ? returnValue : cleanupNoop
    const signal = abortController.signal

    Abortable.followSignal(operation, signal, cleanup)
    return {
      signal,
      cleanup,
    }
  },

  timeout: (operation, ms) => {
    return Abortable.effect(operation, (abort) => {
      const timeoutId = setTimeout(abort, ms)
      return () => {
        clearTimeout(timeoutId)
      }
    })
  },

  cleanOnAbort: (operation) => {
    const removeAbortEventListener = addEventListener(
      operation.signal,
      "abort",
      () => {
        removeAbortEventListener()
        operation.cleaner.clean("operation aborted")
      },
    )
    return removeAbortEventListener
  },

  // Provide a signal to the callback
  // this signal won't inherit the current signal max listeners
  asyncCallback: async (operation, asyncFunction) => {
    Abortable.throwIfAborted(operation)

    const abortController = new AbortController()
    const signal = abortController.signal

    const removeParentAbortCallback = operation.abortSignal.addCallback(() => {
      abortController.abort()
    })

    try {
      const value = await asyncFunction(signal)
      removeParentAbortCallback()
      return value
    } catch (e) {
      removeParentAbortCallback()
      throw e
    }
  },
}

const cleanupNoop = () => {}

const addEventListener = (target, eventName, cb) => {
  target.addEventListener(eventName, cb)
  return () => {
    target.removeEventListener(eventName, cb)
  }
}
