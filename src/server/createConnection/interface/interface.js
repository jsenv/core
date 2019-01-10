import * as body from "./body.js"
import * as nodeStream from "./nodeStream.js"
import * as rawSource from "./rawSource.js"

export const onData = (source, cb) => {
  if (body.is(source)) return body.onData(source, cb)
  if (nodeStream.is(source)) return nodeStream.onData(source, cb)
  return rawSource.onData(source, cb)
}

export const onceErrored = (source, cb) => {
  if (body.is(source)) return body.onceErrored(source, cb)
  if (nodeStream.is(source)) return nodeStream.onceErrored(source, cb)
  return rawSource.onceErrored(source, cb)
}

export const onceCanceled = (source, cb) => {
  if (body.is(source)) return body.onceCanceled(source, cb)
  if (nodeStream.is(source)) return nodeStream.onceCanceled(source, cb)
  return rawSource.onceCanceled(source, cb)
}

export const onceEnded = (source, cb) => {
  if (body.is(source)) return body.onceEnded(source, cb)
  if (nodeStream.is(source)) return nodeStream.onceEnded(source, cb)
  return rawSource.onceEnded(source, cb)
}

export const write = (source, data) => {
  if (body.is(source)) return body.write(source, data)
  if (nodeStream.is(source)) return nodeStream.write(source, data)
  return rawSource.write(source, data)
}

export const error = (source, error) => {
  if (body.is(source)) return body.error(source, error)
  if (nodeStream.is(source)) return nodeStream.error(source, error)
  return rawSource.error(source, error)
}

export const cancel = (source) => {
  if (body.is(source)) return body.cancel(source)
  if (nodeStream.is(source)) return nodeStream.cancel(source)
  return rawSource.cancel(source)
}

export const end = (source, cb) => {
  if (body.is(source)) return body.end(source, cb)
  if (nodeStream.is(source)) return nodeStream.end(source, cb)
  return rawSource.end(source, cb)
}
