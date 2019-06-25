import { createObservable } from "../observable/index.js"

export const nodeStreamToObservable = (nodeStream) => {
  return createObservable({
    subscribe: ({ next, error, complete }) => {
      // should we do nodeStream.resume() in case the stream was paused
      nodeStream.on("data", next)
      nodeStream.once("error", error)
      nodeStream.once("end", complete)

      const unsubscribe = () => {
        nodeStream.removeListener("data", next)
        nodeStream.removeListener("error", error)
        nodeStream.removeListener("end", complete)

        if (nodeStreamIsNodeRequest(nodeStream)) {
          nodeStream.abort()
        } else {
          nodeStream.destroy()
        }
      }

      if (nodeStreamIsNodeRequest(nodeStream)) {
        nodeStream.once("abort", unsubscribe)
      }

      return {
        unsubscribe,
      }
    },
  })
}

const nodeStreamIsNodeRequest = (nodeStream) =>
  "abort" in nodeStream && "flushHeaders" in nodeStream
