export const createSignal = () => {
  let listeners = []

  const listen = (callback, { once = false } = {}) => {
    if (once) {
      const callbackOriginal = callback
      callback = (...args) => {
        stopListening()
        callbackOriginal(...args)
      }
    }

    listeners = [...listeners, callback]

    let removed = false
    const stopListening = () => {
      if (removed) return
      removed = true
      const listenersWithoutCallback = []
      let i = listeners.length
      let searching = true
      while (i--) {
        const listenerCandidate = listeners[i]
        if (searching) {
          if (listenerCandidate === callback) {
            searching = false
          } else {
            listenersWithoutCallback.push(listenerCandidate)
          }
        } else {
          listenersWithoutCallback.push(listenerCandidate)
        }
      }
      listeners = listenersWithoutCallback
    }
    return stopListening
  }

  const emit = (...args) => {
    listeners.forEach((listener) => {
      listener(...args)
    })
  }

  return {
    listen,
    emit,
  }
}
