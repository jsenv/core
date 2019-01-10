import { twoWayStreamSymbol } from "../createTwoWayStream.js"

export const is = (a) => {
  return a && typeof a === "object" && twoWayStreamSymbol in a
}

export const onceErrored = (body, callback) => {
  return oncePromiseResolved(body.errored, callback)
}

export const onceCanceled = (body, callback) => {
  return oncePromiseResolved(body.cancelled, callback)
}

export const onData = (body, callback) => {
  return body.listenData(callback)
}

export const onceEnded = (body, callback) => {
  return oncePromiseResolved(body.ended, callback)
}

export const error = (body, value) => {
  return body.error(value)
}

export const cancel = (body, reason) => {
  return body.cancel(reason)
}

export const write = (body, data) => {
  return body.write(data)
}

export const end = (body) => {
  return body.end()
}

const oncePromiseResolved = (promise, callback) => {
  let removed = false
  promise.then((value) => {
    if (removed === false) callback(value)
  })
  return () => {
    removed = true
  }
}
