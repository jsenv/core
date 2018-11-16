import { arrayWithout } from "../arrayHelper.js"

// https://github.com/tc39/proposal-cancellation/tree/master/stage0
export const createCanceledError = (reason) => {
  const canceledError = new Error(`canceled because ${reason}`)
  canceledError.name = "CANCELED_ERROR"
  return canceledError
}

export const toRejectedPromise = (reason) => Promise.reject(createCanceledError(reason))

// It may lead to memory leak but it has to be tested
export const toPendingPromise = () => new Promise(() => {})

const pendingFlag = {}
export const cancellationTokenToPromise = ({ toRequestedPromise }) => {
  return Promise.race([toRequestedPromise(), Promise.resolve(pendingFlag)]).then((value) => {
    return value === pendingFlag ? undefined : toPendingPromise(value)
  })
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
    if (index > -1) {
      return () => {
        callbacks = arrayWithout(callbacks, callback)
      }
    }
    callbacks = [callback, ...callbacks]
    return () => {
      callbacks = arrayWithout(callbacks, callback)
    }
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

export const cancellationTokenWrapPromise = (cancellationToken, promise) => {
  return Promise.race([promise, cancellationToken.toRequestedPromise().then(toPendingPromise)])
}

// export const cancelllationTokenCanceled = {
//   register: () => () => {},
//   isRequested: () => true,
//   toPromise: () => cancellationToPromise(),
// }
