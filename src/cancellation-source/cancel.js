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

const createAutoCleanedRegistrable = () => {
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

export const createCancellationSource = () => {
  let canceled = false

  const isCanceled = () => canceled

  const { register, getRegisteredCallbacks } = createAutoCleanedRegistrable()

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
    token: {
      register,
      isRequested: isCanceled,
      toPromise,
    },
    cancel,
  }
}

export const cancellationTokenCompose = (...tokens) => {
  const register = (callback) => {
    const unregisters = tokens.map((token) => token.register(callback))
    return () => unregisters.forEach((unregister) => unregister())
  }

  const isRequested = () => tokens.some((token) => token.isRequested())

  const toPromise = () => (isRequested() ? cancellationToPromise() : Promise.resolve())

  return {
    register,
    isRequested,
    toPromise,
  }
}

export const createCancellationToken = () => {
  const { register } = createAutoCleanedRegistrable()

  return {
    register,
    isRequested: () => false,
    toPromise: () => Promise.resolve(),
  }
}

// export const cancelllationTokenCanceled = {
//   register: () => () => {},
//   isRequested: () => true,
//   toPromise: () => cancellationToPromise(),
// }
