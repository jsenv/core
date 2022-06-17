import { listenEvent } from "./listenEvent.js"

export const listenClientError = (nodeServer, clientErrorCallback) => {
  if (nodeServer._httpServer) {
    const removeNetClientError = listenEvent(
      nodeServer,
      "clientError",
      clientErrorCallback,
    )
    const removeHttpClientError = listenEvent(
      nodeServer._httpServer,
      "clientError",
      clientErrorCallback,
    )
    const removeTlsClientError = listenEvent(
      nodeServer._tlsServer,
      "clientError",
      clientErrorCallback,
    )
    return () => {
      removeNetClientError()
      removeHttpClientError()
      removeTlsClientError()
    }
  }
  return listenEvent(nodeServer, "clientError", clientErrorCallback)
}
