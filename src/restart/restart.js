import { createOnceSignal } from "../functionHelper.js"

export const createRestartSource = () => {
  const { register, getRegisteredCallbacks } = createOnceSignal()

  let opened = false
  const isOpened = () => opened

  let restartImplementation
  let restartPromise
  const open = (callback) => {
    opened = true
    // you can provide the restartImplementation
    // even if currently restarting, it's ok
    restartImplementation = callback
    restartPromise = undefined

    let closed = false // repeated call to close must be ignored
    return () => {
      if (closed) return
      closed = true
      opened = false
      restartImplementation = undefined
      restartPromise = undefined
    }
  }

  const restart = (reason) => {
    if (opened === false) {
      return Promise.resolve()
    }
    if (restartPromise) {
      return restartPromise
    }

    getRegisteredCallbacks().forEach((callback) => callback(reason))
    restartPromise = Promise.resolve().then(() => restartImplementation(reason))

    return restartPromise
  }

  const token = {
    register,
    isOpened,
    open,
  }

  return { restart, token }
}

export const createRestartToken = () => {
  const { register } = createOnceSignal()

  return {
    register,
    isOpened: () => false,
    open: () => () => {},
  }
}

export const restartTokenCompose = (...restartTokens) => {
  const restartToken = {
    register: (callback) => {
      const unregisters = restartTokens.map((restartToken) => restartToken.register(callback))
      return () => unregisters.forEach((unregister) => unregister())
    },
    isOpened: () => restartTokens.some((restartToken) => restartToken.isOpened()),
    open: (callback) => restartTokens.forEach((restartToken) => restartToken.open(callback)),
  }

  return restartToken
}
