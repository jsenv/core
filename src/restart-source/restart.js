const createRegistrable = () => {
  const callbackSet = new Set()

  const register = (callback) => {
    callbackSet.add(callback)
    return () => {
      callbackSet.delete(callback)
    }
  }

  const getRegisteredCallbacks = () => {
    const callbacks = Array.from(callbackSet.values())
    return callbacks
  }

  return { register, getRegisteredCallbacks }
}

export const createRestartSource = () => {
  let restarted = false

  const isRestarted = () => restarted

  const { register, getRegisteredCallbacks } = createRegistrable()

  let restartPromise = Promise.resolve()
  const restart = (reason) => {
    if (restarted) {
      return restartPromise
    }
    restarted = true
    getRegisteredCallbacks().forEach((callback) => callback(reason))

    return restartPromise
  }

  const setPromise = (promise) => {
    promise.then(() => {
      restarted = false
    })
    restartPromise = promise
  }

  const token = {
    register,
    isRequested: isRestarted,
    setPromise,
  }

  return { restart, token }
}

export const createRestartToken = () => {
  const { register } = createRegistrable()

  return {
    register,
    isRequested: () => false,
    setPromise: () => {},
  }
}

export const restartTokenCompose = (...restartTokens) => {
  const restartToken = {
    register: (callback) => {
      const unregisters = restartTokens.map((restartToken) => restartToken.register(callback))
      return () => unregisters.forEach((unregister) => unregister())
    },
    isRequested: () => restartTokens.some((restartToken) => restartToken.isRequested()),
    setPromise: (promise) =>
      restartTokens.forEach((restartToken) => restartToken.setPromise(promise)),
  }

  return restartToken
}
