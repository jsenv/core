import { createPromiseAndHooks } from "../promise.js"

const createLock = () => {
  let unusedCallback
  const onceUnused = (callback) => {
    unusedCallback = callback
  }

  const pendings = []
  let busy = false

  const chain = (callback) => {
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
        const { resolve, callback } = pendings.shift()
        resolve(chain(callback))
      }
    }

    promise.then(fullfilledOrRejected, fullfilledOrRejected)

    return promise
  }

  return { chain, onceUnused }
}

export const createLockRegistry = () => {
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
  return { lockForRessource }
}
