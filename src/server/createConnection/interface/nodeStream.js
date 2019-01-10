import stream from "stream"

export const is = (a) => {
  if (a === undefined) return false
  if (a instanceof stream.Stream || a instanceof stream.Writable) return true
  return false
}

export const onceErrored = (nodeStream, callback) => {
  nodeStream.once("error", callback)
  return () => {
    nodeStream.removeListener("error", callback)
  }
}

export const onceCanceled = (nodeStream, callback) => {
  // https://nodejs.org/api/http.html#http_event_abort
  if (nodeStreamIsNodeClientRequest(nodeStream)) {
    nodeStream.once("abort", callback)
    return () => {
      nodeStream.removeListener("abort", nodeStream)
    }
  }
  // there is no cancel event on node stream
  return () => {}
}

export const onData = (nodeStream, callback) => {
  // should we do nodeStream.resume() in case the stream was paused
  nodeStream.on("data", callback)
  return () => {
    nodeStream.removeListener("data", callback)
  }
}

export const onceEnded = (nodeStream, callback) => {
  nodeStream.once("end", callback)
  return () => {
    nodeStream.removeListener("end", callback)
  }
}

export const error = (nodeStream, value) => {
  nodeStream.emit("error", value)
}

export const cancel = (nodeStream) => {
  if (nodeStreamIsNodeClientRequest(nodeStream)) return stream.abort()
  return nodeStream.destroy()
}

export const write = (nodeStream, data) => {
  return nodeStream.write(data)
}

export const end = (nodeStream) => {
  if (nodeStream.end) {
    // only writable stream got end method
    return nodeStream.end()
  }
  return undefined
}

const nodeStreamIsNodeClientRequest = (nodeStream) =>
  "abort" in nodeStream && "flushHeaders" in nodeStream
