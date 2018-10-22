import stream from "stream"

export const isNodeStream = (a) => {
  if (a === undefined) return false
  if (a instanceof stream.Stream || a instanceof stream.Writable) {
    return true
  }
  return false
}
