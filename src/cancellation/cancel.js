import { arrayWithout } from "../arrayHelper.js"

// https://github.com/tc39/proposal-cancellation/tree/master/stage0
export const createCanceledError = (reason) => {
  const canceledError = new Error(`canceled because ${reason}`)
  canceledError.name = "CANCELED_ERROR"
  return canceledError
}

export const cancellationToRejectedPromise = (reason) => Promise.reject(createCanceledError(reason))

// It may lead to memory leak but it has to be tested
export const cancellationToPendingPromise = () => new Promise(() => {})

export const cancellationTokenToPromise = ({ toRequestedPromise }) => {
  return Promise.race([
    toRequestedPromise().then(cancellationToPendingPromise),
    new Promise((resolve) => resolve()),
  ])
}

export const createCancellationSource = () => {
  let canceled = false
  let callbacks = []
  let requestedResolve
  let cancelPromise
  const requestedPromise = new Promise((resolve) => {
    requestedResolve = resolve
  })

  const toRequestedPromise = () => requestedPromise

  const cancel = (reason) => {
    if (canceled) return cancelPromise
    canceled = true
    requestedResolve(reason)

    const values = []
    cancelPromise = callbacks
      .reduce((previous, callback, index) => {
        return previous.then(() => callback(reason)).then((value) => {
          values[index] = value
        })
      }, Promise.resolve())
      .then(() => values)
    return cancelPromise
  }

  const register = (callback) => {
    const index = callbacks.indexOf(callback)
    if (index === -1) {
      callbacks = [callback, ...callbacks]
      return () => {
        arrayWithout(callbacks, callback)
      }
    }
    return () => {}
  }

  return {
    token: {
      toRequestedPromise,
      register,
    },
    cancel,
  }
}

export const cancellationTokenCompose = (...tokens) => {
  const register = (callback) => {
    const unregisters = tokens.map((token) => token.register(callback))
    return () => unregisters.forEach((unregister) => unregister())
  }

  const toRequestedPromise = () => {
    return Promise.race([tokens.map((token) => token.toRequestedPromise())])
  }

  return {
    toRequestedPromise,
    register,
  }
}

export const createCancellationToken = () => {
  return {
    toRequestedPromise: () => new Promise(() => {}),
    register: () => () => {},
  }
}

// export const cancelllationTokenCanceled = {
//   register: () => () => {},
//   isRequested: () => true,
//   toPromise: () => cancellationToPromise(),
// }
