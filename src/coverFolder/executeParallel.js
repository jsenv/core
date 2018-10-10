export const executeParallel = (callback, list, { maxParallelExecution = 5 } = {}) => {
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
