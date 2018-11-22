import { createCancellationToken, cancellationTokenToPromise } from "@dmail/cancellation"

export const promiseMatch = (callbacks, data, predicate) => {
  return new Promise((resolve, reject) => {
    const visit = (index) => {
      if (index >= callbacks.length) {
        return resolve()
      }
      const callback = callbacks[index]
      return Promise.resolve(callback(data)).then((value) => {
        if (predicate(value)) {
          return resolve(value)
        }
        return visit(index + 1)
      }, reject)
    }

    visit(0)
  })
}

export const createPromiseAndHooks = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  promise.resolve = resolve
  promise.reject = reject

  return promise
}

export const promiseTry = (callback) => {
  return Promise.resolve().then(() => {
    return callback()
  })
}

export const promiseSequence = (callbacks, cancellationToken = createCancellationToken()) => {
  const values = []

  return callbacks
    .reduce((previous, callback, index) => {
      if (typeof callback !== "function") {
        throw new TypeError(
          `promiseSequence arguments must be function, got ${callback} at ${index}`,
        )
      }
      return previous.then(() => callback()).then((value) => {
        values.push(value)
        return cancellationTokenToPromise(cancellationToken)
      })
    }, cancellationTokenToPromise(cancellationToken))
    .then(() => values)
}

export const promiseConcurrent = (
  list,
  callback,
  { cancellationToken = createCancellationToken(), maxParallelExecution = 5 } = {},
) => {
  const results = []
  const firstChunk = list.slice(0, maxParallelExecution)
  let globalIndex = maxParallelExecution - 1

  const execute = (data, index) => {
    return promiseTry(() => callback(data)).then((value) => {
      results[index] = value

      return cancellationTokenToPromise(cancellationToken).then(() => {
        if (globalIndex < list.length - 1) {
          globalIndex++
          return execute(list[globalIndex], globalIndex)
        }
        return undefined
      })
    })
  }

  return cancellationTokenToPromise(cancellationToken).then(() => {
    const promises = firstChunk.map((data, index) => execute(data, index))
    const promise = Promise.all(promises).then(() => results)
    return promise
  })
}

export const objectToPromiseAll = (object) => {
  const result = {}

  const promises = Object.keys(object).map((name) => {
    return Promise.resolve(object[name]).then((value) => {
      result[name] = value
    })
  })

  return Promise.all(promises).then(() => result)
}

export const millisecondToResolved = (millisecond) => {
  return new Promise((resolve) => {
    setTimeout(resolve, millisecond)
  })
}

export const reduceToFirstOrPending = (values) => {
  return new Promise((resolve, reject) => {
    let otherResolved = false

    const visit = (index) => {
      const value = values[index]
      Promise.resolve(value).then((value) => {
        if (otherResolved) {
          return
        }
        if (index === 0) {
          resolve(value)
          return
        }
        otherResolved = true
      }, reject)
    }

    let i = values.length
    while (i--) {
      visit(i)
    }
  })
}

const flag = {}
export const mapPending = (promise, callback) => {
  return Promise.race([promise, flag]).then((value) => {
    if (value === flag) {
      return callback()
    }
    return value
  })
}

export const promiseTrackRace = (promises) => {
  return new Promise((resolve, reject) => {
    let resolved = false

    const visit = (i) => {
      const promise = promises[i]
      promise.then((value) => {
        if (resolved) return
        resolved = true
        resolve({ winner: promise, value })
      }, reject)
    }

    let i = 0
    while (i < promises.length) {
      visit(i++)
    }
  })
}

// https://raw.githubusercontent.com/tc39/proposal-promise-finally/fd934c0b42d59bf8d9446e737ba14d50a9067216/polyfill.js
if (typeof Promise !== "function") {
  throw new TypeError("A global Promise is required")
}

if (typeof Promise.prototype.finally !== "function") {
  var speciesConstructor = function(O, defaultConstructor) {
    if (!O || (typeof O !== "object" && typeof O !== "function")) {
      throw new TypeError("Assertion failed: Type(O) is not Object")
    }
    var C = O.constructor
    if (typeof C === "undefined") {
      return defaultConstructor
    }
    if (!C || (typeof C !== "object" && typeof C !== "function")) {
      throw new TypeError("O.constructor is not an Object")
    }
    var S =
      typeof Symbol === "function" && typeof Symbol.species === "symbol"
        ? C[Symbol.species]
        : undefined
    if (S === null) {
      return defaultConstructor
    }
    if (typeof S === "function" && S.prototype) {
      return S
    }
    throw new TypeError("no constructor found")
  }

  var shim = {
    finally(onFinally) {
      var promise = this
      if (typeof promise !== "object" || promise === null) {
        throw new TypeError('"this" value is not an Object')
      }
      var C = speciesConstructor(promise, Promise) // throws if SpeciesConstructor throws
      if (typeof onFinally !== "function") {
        return Promise.prototype.then.call(promise, onFinally, onFinally)
      }
      return Promise.prototype.then.call(
        promise,
        (x) => new C((resolve) => resolve(onFinally())).then(() => x),
        (e) =>
          new C((resolve) => resolve(onFinally())).then(() => {
            throw e
          }),
      )
    },
  }
  // eslint-disable-next-line no-extend-native
  Object.defineProperty(Promise.prototype, "finally", {
    configurable: true,
    writable: true,
    value: shim.finally,
  })
}
