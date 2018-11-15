// https://github.com/tc39/proposal-cancellation/tree/master/stage0
import { createOnceSignal } from "../functionHelper.js"

export const createCanceledError = (reason) => {
  const canceledError = new Error(`canceled because ${reason}`)
  canceledError.name = "CANCELED_ERROR"
  return canceledError
}

export const cancellationToPendingPromise = () => new Promise(() => {})

export const cancellationToRejectedPromise = (reason) => Promise.reject(createCanceledError(reason))

// It may lead to memroy leak but it has to be tested
const cancellationToPromise = cancellationToPendingPromise

export const createCancellationSource = () => {
  let canceled = false

  const isCanceled = () => canceled

  const { register, getRegisteredCallbacks } = createOnceSignal()

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
  const { register } = createOnceSignal()

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
