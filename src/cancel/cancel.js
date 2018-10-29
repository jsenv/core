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
      callbackSet.delete(callback)
    }
  }

  const getRegisteredCallbacks = () => {
    const callbacks = Array.from(callbackSet.values())
    callbackSet.clear()
    return callbacks
  }

  const promiseToCancellablePromise = (promise) => {
    const cancellablePromise = new Promise((resolve) => {
      promise.then((value) => {
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

  const wrap = (fn) => {
    if (isCanceled()) {
      return behaviour()
    }

    let executionPromise
    let executionDone = false
    const registerPromise = new Promise((resolve) => {
      executionPromise = new Promise((executionResolve) => {
        let registerCalled = false
        const scopedRegister = (callback) => {
          if (registerCalled) {
            throw new Error("register must be called once per wrap")
          }
          if (executionDone) {
            throw new Error("register cannot be called once wrapped call has resolved")
          }
          resolve()
          registerCalled = true
          return register(callback)
        }

        executionResolve(fn(scopedRegister))
      })
      executionPromise.then(() => {
        executionDone = true
        resolve()
      })
    })
    waitFor(registerPromise)

    return promiseToCancellablePromise(executionPromise)
  }

  return { wrap, getRegisteredCallbacks }
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

  const { wrap, getRegisteredCallbacks } = createCancellation(
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
      const values = []
      return getRegisteredCallbacks()
        .reverse()
        .reduce((previous, callback, index) => {
          return previous.then(() => callback(reason)).then((value) => {
            values[index] = value
          })
        }, Promise.resolve())
        .then(() => values)
    })
    return canceledPromise
  }

  return {
    cancellation: {
      isRequested: isCanceled,
      wrap,
    },
    cancel,
  }
}

export const cancellationNone = {
  isRequested: () => false,
  wrap: (fn) =>
    new Promise((resolve) => {
      resolve(fn(() => () => {}))
    }),
}
