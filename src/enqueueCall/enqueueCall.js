import { createStore, memoizeSync } from "../memoize.js"
import { createPromiseAndHooks } from "../promise.js"

const createExecutionQueue = () => {
  const pendings = []
  let running = false

  const enqueue = (fn, ...args) => {
    if (running) {
      const { promise, resolve, reject } = createPromiseAndHooks()
      pendings.push({ promise, resolve, reject, fn, args })
      return promise
    }
    running = true

    const onPassedOrFailed = () => {
      running = false
      if (pendings.length > 0) {
        const { resolve, fn, args } = pendings.shift()
        resolve(enqueue(fn, ...args))
      }
    }

    const promise = Promise.resolve(fn(...args))

    promise.then(onPassedOrFailed, onPassedOrFailed)

    return promise
  }

  return enqueue
}

export const enqueueCall = (fn) => {
  const enqueue = createExecutionQueue()
  return (...args) => enqueue(fn, ...args)
}

export const enqueueCallByArgs = (fn) => {
  return memoizeSync(
    createExecutionQueue,
    createStore({
      transform: (enqueue, ...args) => enqueue(fn, ...args),
    }),
  )
}

const createLock = () => {
  let unusedCallback
  const onceUnused = (callback) => {
    unusedCallback = callback
  }

  const pendings = []
  let busy = false

  const registerCallbackOnAvailable = (callback) => {
    if (busy) {
      const { promise, resolve, reject } = createPromiseAndHooks()
      pendings.push({ promise, resolve, reject, callback })
      return promise
    }

    busy = true
    const promise = Promise.resolve().then(callback)

    const fullfilledOrRejected = () => {
      busy = false
      if (pendings.length === 0) {
        if (unusedCallback) {
          unusedCallback()
          unusedCallback = undefined
        }
      } else {
        const { resolve, fn } = pendings.shift()
        resolve(registerCallbackOnAvailable(fn))
      }
    }

    promise.then(fullfilledOrRejected, fullfilledOrRejected)

    return promise
  }

  return { registerCallbackOnAvailable, onceUnused }
}

const lockBindings = []
const lockForRessource = (ressource) => {
  const lockBinding = lockBindings.find((lockBinding) => lockBinding.ressource === ressource)
  if (lockBinding) {
    return lockBinding.lock
  }

  const lock = createLock()
  lockBindings.push({
    lock,
    ressource,
  })
  // to avoid lockBindings to grow for ever
  // we remove them from the array as soon as the ressource is not used anymore
  lock.onceUnused(() => {
    const index = lockBindings.indexOf(lock)
    lockBindings.splice(index, 1)
  })

  return lock
}

const fileLock = lockForRessource("file.js")

fileLock.registerCallbackOnAvailable(() => {
  // appelle la fonction
})
