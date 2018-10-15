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
  const results = []
  const firstChunk = list.slice(0, maxParallelExecution)
  let globalIndex = maxParallelExecution - 1

  const execute = (data, index) => {
    return Promise.resolve()
      .then(() => callback(data))
      .then((value) => {
        results[index] = value

        if (globalIndex < list.length - 1) {
          globalIndex++
          return execute(list[globalIndex], globalIndex)
        }
        return undefined
      })
  }

  const promises = firstChunk.map((data, index) => execute(data, index))
  return Promise.all(promises).then(() => results)
}
