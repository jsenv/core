// https://github.com/jamestalmage/stream-to-observable/blob/master/index.js
import { Readable } from "node:stream"
import { createObservable } from "./observable.js"

export const observableFromNodeStream = (
  nodeStream,
  {
    readableStreamLifetime = 120_000, // 2s
  } = {},
) => {
  const observable = createObservable(({ next, error, complete }) => {
    if (nodeStream.isPaused()) {
      nodeStream.resume()
    } else if (nodeStream.complete) {
      complete()
      return null
    }
    const cleanup = () => {
      nodeStream.removeListener("data", next)
      nodeStream.removeListener("error", error)
      nodeStream.removeListener("end", complete)
      nodeStream.removeListener("close", cleanup)
      nodeStream.destroy()
    }
    // should we do nodeStream.resume() in case the stream was paused ?
    nodeStream.once("error", error)
    nodeStream.on("data", (data) => {
      next(data)
    })
    nodeStream.once("close", () => {
      cleanup()
    })
    nodeStream.once("end", () => {
      complete()
    })
    return cleanup
  })

  if (nodeStream instanceof Readable) {
    // safe measure, ensure the readable stream gets
    // used in the next ${readableStreamLifetimeInSeconds} otherwise destroys it
    const timeout = setTimeout(() => {
      process.emitWarning(
        `Readable stream not used after ${
          readableStreamLifetime / 1000
        } seconds. It will be destroyed to release resources`,
        {
          CODE: "READABLE_STREAM_TIMEOUT",
          // url is for http client request
          detail: `path: ${nodeStream.path}, fd: ${nodeStream.fd}, url: ${nodeStream.url}`,
        },
      )
      nodeStream.destroy()
    }, readableStreamLifetime)
    observable.timeout = timeout
    onceReadableStreamUsedOrClosed(nodeStream, () => {
      clearTimeout(timeout)
    })
  }

  return observable
}

const onceReadableStreamUsedOrClosed = (readableStream, callback) => {
  const dataOrCloseCallback = () => {
    readableStream.removeListener("data", dataOrCloseCallback)
    readableStream.removeListener("close", dataOrCloseCallback)
    callback()
  }
  readableStream.on("data", dataOrCloseCallback)
  readableStream.once("close", dataOrCloseCallback)
}
