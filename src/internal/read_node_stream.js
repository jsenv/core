export const readNodeStream = (nodeStream) => {
  return new Promise((resolve, reject) => {
    if (nodeStream.isPaused()) {
      nodeStream.resume()
    } else if (nodeStream.complete) {
      resolve(Buffer.from(""))
      return
    }
    const buffers = []
    const errorCallback = (e) => {
      cleanup()
      reject(e)
    }
    const dataCallback = (chunk) => {
      buffers.push(chunk)
    }
    const endCallback = () => {
      const body = Buffer.concat(buffers)
      cleanup()
      resolve(body)
    }
    const cleanup = () => {
      buffers.length = 0
      nodeStream.removeListener("data", dataCallback)
      nodeStream.removeListener("error", errorCallback)
      nodeStream.removeListener("end", endCallback)

      nodeStream.destroy()
    }
    nodeStream.on("error", errorCallback)
    nodeStream.on("data", dataCallback)
    nodeStream.on("end", endCallback)
  })
}
