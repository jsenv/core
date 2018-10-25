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

  return { promise, resolve, reject }
}

export const promiseTry = (callback) => {
  return Promise.resolve().then(() => {
    return callback()
  })
}

export const promiseSequence = (...callbacks) => {
  const values = []

  return callbacks
    .reduce((previous, callback, index) => {
      if (typeof callback !== "function") {
        throw new TypeError(
          `promiseSequence arguments must be function, got ${callback} at ${index}`,
        )
      }
      return previous.then(callback).then((value) => {
        values.push(value)
      })
    }, Promise.resolve())
    .then(() => values)
}

export const promiseConcurrent = (list, callback, { maxParallelExecution = 5 } = {}) => {
  let cancelled = false
  const cancel = () => {
    cancelled = true
  }

  const results = []
  const firstChunk = list.slice(0, maxParallelExecution)
  let globalIndex = maxParallelExecution - 1

  const execute = (data, index) => {
    return Promise.resolve()
      .then(() => callback(data))
      .then((value) => {
        if (cancelled) {
          return undefined
        }

        results[index] = value

        if (globalIndex < list.length - 1) {
          globalIndex++
          return execute(list[globalIndex], globalIndex)
        }
        return undefined
      })
  }

  const promises = firstChunk.map((data, index) => execute(data, index))
  const promise = Promise.all(promises).then(() => results)
  promise.cancel = cancel
  return promise
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
