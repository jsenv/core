/*
Takes an array of signal and a callback function
Calls callback when one of the signal emits. All other signal emission will be ignored.
callback is called with {index, args, signal}
- index: the index of the first signal to emit
- args: the args passed by the first signal emit
- signal: the first signal to emit
*/
export const signalRace = (signals, callback) => {
  let emitted = false
  const listeners = []

  const cancel = () => {
    listeners.forEach((listener) => listener.remove())
    listeners.length = 0
  }

  let i = 0
  while (i < signals.length) {
    const signal = signals[i]
    const index = i
    i++
    // eslint-disable-next-line no-loop-func
    const listener = signal.listenOnce((...args) => {
      emitted = true
      listeners.forEach((listener) => listener.remove())
      listeners.length = 0
      callback({ signal, index, args })
    })
    if (emitted) {
      break
    }
    listeners.push(listener)
  }

  return cancel
}

export const cancellableAction = (callback, triggerSignal, ...cancelSignals) => {
  return signalRace([triggerSignal, ...cancelSignals], ({ index, args }) => {
    if (index === 0) {
      callback(...args)
    }
  })
}
