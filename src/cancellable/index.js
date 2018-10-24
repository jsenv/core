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

export const promiseToCancellablePromise = (promise, cancelSignal) => {
  const cancelledPromise = new Promise((resolve, reject) => {
    cancelSignal.listenOnce((value) => {
      reject(dataToCancelToken(value))
    })
  })

  const promiseWithCancel = Promise.race([cancelledPromise, promise])
  promiseWithCancel.cancel = cancelSignal.emit

  return promiseWithCancel
}
