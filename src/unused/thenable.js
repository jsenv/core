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

export const createThenable = (execute) => {
  let resolveOrRejectCalled = false // true while resolve / reject not called
  let settled = false // true once resolve/reject or cancel is done
  const settledCallbacks = []
  let rejected = false
  let outcome

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
    onsettle()
  }

  const resolveInternal = (value) => {
    if (settled) {
      return
    }

    try {
      if (isThenable(value)) {
        callThenable(value, resolveInternal, rejectInternal)
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

  const then = (valueCallback, errorCallback) => {
    const nextCancellableThenable = createThenable((resolve, reject) => {
      const settledCallback = () => {
        Promise.resolve().then(() => {
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

    return nextCancellableThenable
  }

  const catchFunction = (errorCallback) => then(undefined, errorCallback)

  try {
    execute(resolve, reject)
  } catch (e) {
    reject(e)
  }

  return {
    [Symbol.species]: () =>
      function ThenableConstructor(execute) {
        return createThenable(execute)
      },
    then,
    catch: catchFunction,
  }
}
