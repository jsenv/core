/*
 * - There is a separation between the signal and its controller
 * - As soon as a signal is transmitted once it's "frozen"
 *   - It cannot swich back to transmitted: false
 *   - Calling signal.addCallback is no-op
 * This keeps signal simple and allows to reuse two constant signals: "DORMANT" and "TRANSMITTED"
 * This simplifies signal composition and make signals easier to garbage collect
 *
 * The signal behaviour described above must not be changed or it might affect
 * their ease to compose, reuse and/or garbage collect
 */

export const Signal = {}

const createFrozenSignal = ({ transmitted, value }) => {
  return {
    transmitted,
    value,
    effect: effectNoop,
    addCallback: addCallbackNoop,
  }
}
const addCallbackNoop = () => {
  return () => {}
}
const effectNoop = () => {}

Signal.dormant = () => SIGNAL_DORMANT
const SIGNAL_DORMANT = createFrozenSignal({ transmitted: false })
Signal.transmit = (value) => {
  // Just perf optim to reuse same signals when value is undefined
  return value === undefined
    ? SIGNAL_TRANSMITTED_UNDEFINED
    : createFrozenSignal({ transmitted: true, value })
}
const SIGNAL_TRANSMITTED_UNDEFINED = createFrozenSignal({ transmitted: true })

Signal.create = () => {
  let callbacks = []
  let cleanupEffect = null

  const signal = {
    transmitted: false,
    value: undefined,
    effect: effectNoop,
    addCallback: (callback) => {
      if (typeof callback !== "function") {
        throw new Error(`callback must be a function, got ${callback}`)
      }

      // don't register twice
      // this test can be defeated by Signal.map
      // so do not rely on it, it's just here to help avoiding mistake, not prevent them entirely
      const existingCallback = callbacks.find((callbackCandidate) => {
        return callbackCandidate === callback
      })
      if (existingCallback) {
        if (typeof process.emitWarning === "object") {
          process.emitWarning(`Trying to register same callback twice`, {
            CODE: "CALLBACK_DUPLICATION",
            detail: `It's often the sign that code is executd more than once`,
          })
        } else {
          console.warn(`Trying to add same callback twice`)
        }
      } else {
        callbacks = [...callbacks, callback]
      }

      if (callbacks.length === 0) {
        cleanupEffect = signal.listenEffect()
      }

      return () => {
        callbacks = arrayWithout(callbacks, callback)
        if (callbacks.length === 0 && typeof cleanupEffect === "function") {
          cleanupEffect()
          cleanupEffect = null
        }
      }
    },
  }

  const transmitSignal = (value) => {
    const callbacksCopy = callbacks.slice()
    callbacks.length = 0
    if (typeof cleanupEffect === "function") {
      cleanupEffect()
      cleanupEffect = null
    }
    callbacksCopy.forEach((callback) => {
      callback(value)
    })
  }

  return [transmitSignal, signal]
}

Signal.composeTwoSignals = (firstSignal, secondSignal) => {
  if (firstSignal.transmitted) {
    return firstSignal
  }

  if (secondSignal.transmitted) {
    return secondSignal
  }

  const compositeSignal = {
    transmitted: false,
    value: undefined,
    // We don't have to manage calling effect/cleanupEffect
    // This signal is the composition of 2 other signals which may have effects
    // on their own, but the effect "API" is hidden behind Signal.from(Function)
    // No-code outside this use case should expect signal.effect = () => {}
    // to be called at some point
    effect: effectNoop,
    addCallback: (callback) => {
      const removeFirstSignalCallback = firstSignal.addCallback((value) => {
        removeSecondSignalCallback()
        markSignalAsTransmitted(compositeSignal, value)
        callback(value)
      })
      const removeSecondSignalCallback = secondSignal.addCallback((value) => {
        removeFirstSignalCallback()
        markSignalAsTransmitted(compositeSignal, value)
        callback(value)
      })
      return () => {
        removeFirstSignalCallback()
        removeSecondSignalCallback()
      }
    },
  }

  return compositeSignal
}

Signal.from = (value) => {
  if (value instanceof global.AbortSignal) {
    const [transmit, signal] = Signal.create()
    const abortEventCallback = () => {
      value.removeEventListener("abort", abortEventCallback)
      transmit("aborted")
    }
    value.addEventListener("abort", abortEventCallback)
    return signal
  }
  if (typeof value === "function") {
    const [transmit, signal] = Signal.create()
    signal.effect = () => value(transmit)
    return signal
  }
  return SIGNAL_DORMANT
}

Signal.map = (signal, transform) => {
  const addCallback = signal.addCallback
  return {
    ...signal,
    addCallback: (callback) => {
      return addCallback((value) => {
        callback(transform(value))
      })
    },
  }
}

Signal.asPromise = (signal) => {
  return new Promise((resolve) => {
    signal.addCallback(resolve)
  })
}

const markSignalAsTransmitted = (signal, value) => {
  signal.transmitted = true
  signal.value = value
  signal.effect = effectNoop
  signal.addCallback = addCallbackNoop
}

const arrayWithout = (array, item) => {
  if (array.length === 0) return array
  const arrayWithoutItem = []
  let i = 0
  while (i < array.length) {
    const value = array[i]
    i++
    if (value === item) {
      continue
    }
    arrayWithoutItem.push(value)
  }
  return arrayWithoutItem
}
