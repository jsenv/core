export const is = () => true

export const onceErrored = () => {
  // source cannot trigger error
  return () => {}
}

export const onceCanceled = () => {
  // raw source has no cancel event
  return () => {}
}

export const onData = (source, cb) => {
  cb(source)
  return () => {}
}

export const onceEnded = (source, cb) => {
  cb()
  return () => {}
}

export const error = () => {
  // should we throw ?
}

export const cancel = () => {}

export const write = () => {}

export const end = () => {}
