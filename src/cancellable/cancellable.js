const isCancellable = (value) => {
  if (value) {
    return typeof value.cancel === "function"
  }
  return false
}

export const cancellable = (execute) => {
  const cleanupCallbackSet = new Set()

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

  const track = (execute) => {
    // in case cancel is called during execute()
    // we ensure the globalExecutionPromise already waits for execute
    // to resolve so that we will have gathered all the cleanupCallback
    // before calling startCancellation()
    let executionResolve
    const executionPromise = new Promise((resolve) => {
      executionResolve = resolve
    })
    globalExecutionPromise = executionPromise.then(() => executionPromise)

    const returnValue = execute((cleanupCallback) => {
      cleanupCallbackSet.add(cleanupCallback)
    })
    executionResolve(returnValue)

    if (isCancellable(returnValue)) {
      cleanupCallbackSet.add(returnValue.cancel)
    }

    const cancellablePromise = new Promise((resolve) => {
      executionPromise.then((value) => {
        if (canceled) {
          return
        }
        resolve(value)
      })
    })
    cancellablePromise.then = (valueCallback) => {
      // when cancelled then/cancel contract still available but noop
      if (canceled) {
        const pending = new Promise(() => {})
        pending.cancel = cancel
        return pending
      }

      const nestedPromise = new Promise((resolve) => {
        executionPromise.then((value) => {
          if (canceled) {
            return
          }
          if (valueCallback) {
            resolve(track(() => valueCallback(value)))
            return
          }
          resolve(value)
        })
      })
      nestedPromise.cancel = cancel
      return nestedPromise
    }
    cancellablePromise.cancel = cancel

    return cancellablePromise
  }

  return track(execute)
}
