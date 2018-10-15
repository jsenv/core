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
