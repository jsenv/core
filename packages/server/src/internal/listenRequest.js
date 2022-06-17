import { listenEvent } from "./listenEvent.js"

export const listenRequest = (nodeServer, requestCallback) => {
  if (nodeServer._httpServer) {
    const removeHttpRequestListener = listenEvent(
      nodeServer._httpServer,
      "request",
      requestCallback,
    )
    const removeTlsRequestListener = listenEvent(
      nodeServer._tlsServer,
      "request",
      requestCallback,
    )
    return () => {
      removeHttpRequestListener()
      removeTlsRequestListener()
    }
  }
  return listenEvent(nodeServer, "request", requestCallback)
}
