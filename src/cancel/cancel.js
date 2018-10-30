// https://github.com/tc39/proposal-cancellation/tree/master/stage0

export const createCanceledError = (reason) => {
  const canceledError = new Error(`canceled because ${reason}`)
  canceledError.name = "CANCELED_ERROR"
  return canceledError
}

export const cancellationToPendingPromise = () => new Promise(() => {})

export const cancellationToRejectedPromise = (reason) => Promise.reject(createCanceledError(reason))

// It may lead to memroy leak but it has to be tested
const cancellationToPromise = cancellationToPendingPromise

const createCancellation = () => {
  const callbackSet = new Set()

  const register = (callback) => {
    callbackSet.add(callback)
    return () => {
      callbackSet.delete(callback)
    }
  }

  const getRegisteredCallbacks = () => {
    const callbacks = Array.from(callbackSet.values())
    callbackSet.clear()
    return callbacks
  }

  return { register, getRegisteredCallbacks }
}

export const createCancel = () => {
  let canceled = false

  const isCanceled = () => {
    return canceled
  }

  const { register, getRegisteredCallbacks } = createCancellation()

  let canceledPromise
  let cancelReason
  const cancel = (reason) => {
    if (canceled) {
      return canceledPromise
    }
    canceled = true
    cancelReason = reason

    const values = []
    canceledPromise = getRegisteredCallbacks()
      .reverse()
      .reduce((previous, callback, index) => {
        return previous.then(() => callback(reason)).then((value) => {
          values[index] = value
        })
      }, Promise.resolve())
      .then(() => values)
    return canceledPromise
  }

  const toPromise = () => {
    return canceled ? cancellationToPromise(cancelReason) : Promise.resolve()
  }

  return {
    cancellation: {
      register,
      isRequested: isCanceled,
      toPromise,
    },
    cancel,
  }
}

export const cancellationNone = {
  register: () => () => {},
  isRequested: () => false,
  toPromise: () => Promise.resolve(),
}
