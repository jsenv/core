// https://github.com/tc39/proposal-cancellation/tree/master/stage0

// const isCancellable = (value) => {
//   if (value) {
//     return typeof value.cancel === "function"
//   }
//   return false
// }

export const behaviourPending = () => {
  return new Promise(() => {})
}

export const behaviourReject = () => {
  const cancelError = new Error(`canceled`)
  cancelError.name = "CANCEL_ERROR"
  return Promise.reject(cancelError)
}

const createCancellation = ({ waitFor, isCanceled }, behaviour) => {
  const callbackSet = new Set()

  const register = (callback) => {
    callbackSet.add(callback)
    return () => {
      callbackSet.remove(callback)
    }
  }

  const getRegisteredCallbacks = () => {
    const callbacks = Array.from(callbackSet.values())
    callbackSet.clear()
    return callbacks
  }

  const wrap = (fn) => {
    if (isCanceled()) {
      return behaviour()
    }

    const executionPromise = new Promise((resolve) => {
      resolve(fn())
    })
    waitFor(executionPromise)

    const cancellablePromise = new Promise((resolve) => {
      executionPromise.then((value) => {
        if (isCanceled()) {
          resolve(behaviour())
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
            if (isCanceled()) {
              return behaviour()
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
            if (isCanceled()) {
              resolve(behaviour())
              return
            }
            resolve(value)
          }, reject)
        })
        promise.then = thenInfected
        return promise
      }
      CancellablePromiseConstructor[Symbol.species] = CancellablePromiseConstructor

      promise.constructor = CancellablePromiseConstructor
      promise.then = thenInfected

      return promise
    }

    return infectPromise(cancellablePromise)
  }

  return { register, getRegisteredCallbacks, wrap }
}

export const createCancel = ({ behaviour = behaviourPending } = {}) => {
  let canceled = false

  const isCanceled = () => {
    return canceled
  }

  let globalExecutionPromise = Promise.resolve()
  const waitFor = (promise) => {
    globalExecutionPromise = globalExecutionPromise.then(() => promise)
  }

  const { register, wrap, getRegisteredCallbacks } = createCancellation(
    {
      waitFor,
      isCanceled,
    },
    behaviour,
  )

  let canceledPromise
  const cancel = (reason) => {
    if (canceled) {
      return canceledPromise
    }
    canceled = true
    canceledPromise = globalExecutionPromise.then(() => {
      return getRegisteredCallbacks()
        .reverse()
        .reduce((previous, callback) => previous.then(() => callback(reason)), Promise.resolve())
    })
    return canceledPromise
  }

  return {
    cancellation: {
      isRequested: isCanceled,
      register,
      wrap,
    },
    cancel,
  }
}

export const cancellationNone = {
  isRequested: () => false,
  register: () => () => {},
  wrap: (fn) =>
    new Promise((resolve) => {
      resolve(fn())
    }),
}
