const isCancellable = (value) => {
  if (value) {
    return typeof value.cancel === "function"
  }
  return false
}

export const createCancel = () => {
  const cleanupCallbackSet = new Set()

  const addCancelCallback = (callback) => {
    cleanupCallbackSet.add(callback)
    return () => {
      cleanupCallbackSet.remove(callback)
    }
  }

  const startCancellation = (reason) => {
    const callbacks = Array.from(cleanupCallbackSet.values()).reverse()
    cleanupCallbackSet.clear()
    return callbacks.reduce(
      (previous, callback) => previous.then(() => callback(reason)),
      Promise.resolve(),
    )
  }

  let globalExecutionPromise = Promise.resolve()
  let canceled = false
  let canceledPromise
  const cancel = (reason) => {
    if (canceled) {
      return canceledPromise
    }
    canceled = true
    canceledPromise = globalExecutionPromise.then(() => startCancellation(reason))
    return canceledPromise
  }

  const cancellable = (value) => {
    if (isCancellable(value)) {
      addCancelCallback(value.cancel)
    }

    const executionPromise = Promise.resolve(value)
    globalExecutionPromise = globalExecutionPromise.then(() => executionPromise)

    const cancellablePromise = new Promise((resolve) => {
      executionPromise.then((value) => {
        if (canceled) {
          return
        }
        resolve(value)
      })
    })

    const infectPromise = (promise) => {
      const thenPure = promise.then
      const thenInfected = function(valueCallback, errorCallback) {
        const nestedPromise = thenPure.call(
          this,
          (value) => {
            if (canceled) {
              return new this.constructor[Symbol.species](() => {})
            }
            return valueCallback ? valueCallback(value) : value
          },
          errorCallback,
        )
        return nestedPromise
      }

      const CancellablePromiseConstructor = function(execute) {
        const promise = new Promise((resolve, reject) => {
          execute((value) => {
            if (canceled) {
              return
            }
            resolve(value)
          }, reject)
        })
        promise.then = thenInfected
        promise.cancel = cancel
        return promise
      }
      CancellablePromiseConstructor[Symbol.species] = CancellablePromiseConstructor

      promise.constructor = CancellablePromiseConstructor
      promise.cancel = cancel
      promise.then = thenInfected

      return promise
    }

    return infectPromise(cancellablePromise)
  }

  return { cancel, cancellable, addCancelCallback }
}
