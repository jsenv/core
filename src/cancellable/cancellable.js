const isCancellable = (value) => {
  if (value) {
    return typeof value.cancel === "function"
  }
  return false
}

export const cancellable = () => {
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
  let cancelledPromise
  const cancel = (reason) => {
    if (canceled) {
      return cancelledPromise
    }
    canceled = true
    cancelledPromise = globalExecutionPromise.then(() => startCancellation(reason))
    return cancelledPromise
  }

  const cancellableStep = (value) => {
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
      const CancellablePromiseConstructor = function(execute) {
        // eslint-disable-next-line no-use-before-define
        const promise = new Promise(execute)
        promise.cancel = cancel
        return promise
      }
      CancellablePromiseConstructor[Symbol.species] = CancellablePromiseConstructor

      promise.constructor = CancellablePromiseConstructor
      promise.cancel = cancel
      return promise
    }

    return infectPromise(cancellablePromise)
  }

  return { cancel, cancellableStep, addCancelCallback }
}
