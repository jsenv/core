const cancelTokenSymbol = Symbol.for("cancelToken")

export const isCancelToken = (value) => {
  return value && typeof value === "object" && cancelTokenSymbol in value
}

const dataToCancelToken = (data) => {
  return {
    [cancelTokenSymbol]: true,
    data,
  }
}

export const cancelTokenToData = (cancelToken) => cancelToken.data

export const createCancellable = () => {
  let resolve
  const promise = new Promise((res) => {
    resolve = res
  })

  const callbacks = []
  let cancelled = false
  const teardown = (callback) => {
    if (cancelled) {
      return () => {}
    }

    callbacks.push(callback)
    return () => {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 0, 1)
      }
    }
  }

  const cancel = (value) => {
    if (cancelled) {
      return promise
    }

    cancelled = true
    resolve(
      callbacks
        .reduce((previous, callback) => previous.then(() => callback(value)), Promise.resolve())
        .then(() => value),
    )
    callbacks.length = 0

    return promise
  }

  return {
    teardown,
    cancel,
    promise,
  }
}

export const promiseToCancellablePromise = (promise, cancellable) => {
  const cancelledPromise = cancellable.promise.then((value) =>
    Promise.reject(dataToCancelToken(value)),
  )

  const promiseWithCancel = Promise.race([cancelledPromise, promise])
  promiseWithCancel.cancel = cancellable.cancel

  return promiseWithCancel
}
