export const getOptionsFromPromise = (Promise) => {
  const addMicrotask = (callback) => Promise.resolve().then(callback)

  const provideFinally = typeof Promise.prototype.finally === "function"

  return {
    addMicrotask,
    provideFinally,
  }
}

const defaultOptions = getOptionsFromPromise(Promise)

const species =
  typeof Symbol === "function" && typeof Symbol.species === "symbol" ? Symbol.species : undefined

const objectToConstructor = (object) => {
  if (!object || (typeof object !== "object" && typeof object !== "function")) {
    throw new TypeError("Assertion failed: Type(O) is not Object")
  }
  const { constructor } = object
  if (typeof constructor === "undefined") return undefined

  if (!species) return undefined

  const constructorSpecies = constructor[species]
  if (typeof constructorSpecies === "function" && constructorSpecies.prototype) {
    return constructorSpecies
  }

  return undefined
}

const isThenable = (value) => {
  if (value) {
    return typeof value.then === "function"
  }
  return false
}

const callThenable = (thenable, valueCallback, errorCallback) => {
  try {
    const then = thenable.then
    then.call(thenable, valueCallback, errorCallback)
  } catch (e) {
    errorCallback(e)
  }
}

export const createThenableConstructor = (
  {
    addMicrotask = defaultOptions.addMicrotask,
    provideFinally = defaultOptions.provideFinally,
    rejectionUnhandled,
    rejectionHandled,
  } = {},
) => {
  const ThenableConstructor = function(execute) {
    // eslint-disable-next-line no-use-before-define
    return createThenable(execute)
  }
  ThenableConstructor[Symbol.species] = ThenableConstructor

  const createThenable = (execute) => {
    let resolveOrRejectCalled = false // true while resolve / reject not called
    let settled = false // true once resolve/reject or cancel is done
    const settledCallbacks = []
    let rejected = false
    let outcomeHandled = false
    let outcome

    const thenable = {}

    const onsettle = () => {
      settledCallbacks.forEach((callback) => callback())
      settledCallbacks.length = 0
    }

    const rejectInternal = (error) => {
      if (settled) {
        return
      }
      settled = true
      rejected = true
      outcome = error

      if (outcomeHandled === false && rejectionUnhandled) {
        addMicrotask(() => {
          if (!outcomeHandled) {
            rejectionUnhandled(outcome, thenable)
          }
        })
      }

      onsettle()
    }

    const resolveInternal = (value) => {
      if (settled) {
        return
      }

      try {
        if (isThenable(value)) {
          callThenable(value, resolveInternal, rejectInternal)
          return
        }

        settled = true
        outcome = value
        onsettle()
      } catch (e) {
        rejectInternal(e)
      }
    }

    const resolve = (value) => {
      if (resolveOrRejectCalled) {
        return
      }
      resolveOrRejectCalled = true
      resolveInternal(value)
    }

    const reject = (error) => {
      if (resolveOrRejectCalled) {
        return
      }
      resolveOrRejectCalled = true
      rejectInternal(error)
    }

    const then = function(valueCallback, errorCallback) {
      const constructor = objectToConstructor(this) || ThenableConstructor
      return new constructor((resolve, reject) => {
        if (!outcomeHandled && rejected && rejectionHandled) {
          rejectionHandled(thenable)
        }
        outcomeHandled = true

        const settledCallback = () => {
          addMicrotask(() => {
            const callback = rejected ? errorCallback : valueCallback

            if (callback) {
              try {
                outcome = callback(outcome)
                rejected = false
              } catch (e) {
                rejected = true
                outcome = e
              }
            }

            if (rejected) {
              reject(outcome)
            } else {
              resolve(outcome)
            }
          })
        }

        if (settled) {
          settledCallback()
        } else {
          settledCallbacks.push(settledCallback)
        }
      })
    }

    const catchFunction = function(errorCallback) {
      return then.call(this, undefined, errorCallback)
    }

    // https://raw.githubusercontent.com/tc39/proposal-promise-finally/master/polyfill.js
    const finallyFunction = (callback) => {
      const constructor = objectToConstructor(this) || ThenableConstructor
      return then.call(
        this,
        (value) => {
          return new constructor((resolve) => resolve(callback())).then(() => value)
        },
        (error) => {
          return new constructor((resolve) => resolve(callback())).then(() => {
            throw error
          })
        },
      )
    }

    try {
      execute(resolve, reject)
    } catch (e) {
      reject(e)
    }

    Object.assign(thenable, {
      constructor: ThenableConstructor,
      then,
      catch: catchFunction,
      ...(provideFinally ? { finally: finallyFunction } : {}),
    })

    return thenable
  }

  const resolve = (value) => createThenable((resolve) => resolve(value))

  const reject = (value) => createThenable((resolve, reject) => reject(value))

  const all = (iterable) =>
    createThenable((resolve, reject) => {
      let callCount = 0
      let resolvedCount = 0
      const values = []
      const resolveOne = (value, index) => {
        try {
          if (isThenable(value)) {
            callThenable(value, (value) => resolveOne(value, index), reject)
          } else {
            values[index] = value
            resolvedCount++
            if (resolvedCount === callCount) {
              resolve(values)
            }
          }
        } catch (e) {
          reject(e)
        }
      }

      let index = 0
      for (const value of iterable) {
        resolveOne(value, index)
        callCount++
        index++
      }

      if (resolvedCount === callCount) {
        // ne peut se produire que si aucun valeur n'est thenable
        resolve(values)
      }
    })

  const race = (iterable) =>
    createThenable((resolve) => {
      const visit = (value) => {
        resolve(value)
      }

      let index = 0
      for (const value of iterable) {
        visit(value, index++)
      }
    })

  Object.assign(ThenableConstructor, {
    resolve,
    reject,
    all,
    race,
  })

  return ThenableConstructor
}

export const getNodeRejectionEmitters = () => {
  const rejectionUnhandled = (error, thenable) => {
    process.emit("unhandledRejection", error, thenable)
  }
  const rejectionHandled = (thenable) => {
    process.emit("rejectionHandled", thenable)
  }

  return { rejectionUnhandled, rejectionHandled }
}
