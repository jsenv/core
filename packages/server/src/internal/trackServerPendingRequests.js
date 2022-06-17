import { listenRequest } from "./listenRequest.js"

export const trackServerPendingRequests = (nodeServer, { http2 }) => {
  if (http2) {
    // see http2.js: we rely on https://nodejs.org/api/http2.html#http2_compatibility_api
    return trackHttp1ServerPendingRequests(nodeServer)
  }
  return trackHttp1ServerPendingRequests(nodeServer)
}

const trackHttp1ServerPendingRequests = (nodeServer) => {
  const pendingClients = new Set()

  const removeRequestListener = listenRequest(
    nodeServer,
    (nodeRequest, nodeResponse) => {
      const client = { nodeRequest, nodeResponse }
      pendingClients.add(client)
      nodeResponse.once("close", () => {
        pendingClients.delete(client)
      })
    },
  )

  const stop = async ({ status, reason }) => {
    removeRequestListener()
    const pendingClientsArray = Array.from(pendingClients)
    pendingClients.clear()
    await Promise.all(
      pendingClientsArray.map(({ nodeResponse }) => {
        if (nodeResponse.headersSent === false) {
          nodeResponse.writeHead(status, String(reason))
        }

        // http2
        if (nodeResponse.close) {
          return new Promise((resolve, reject) => {
            if (nodeResponse.closed) {
              resolve()
            } else {
              nodeResponse.close((error) => {
                if (error) {
                  reject(error)
                } else {
                  resolve()
                }
              })
            }
          })
        }

        // http
        return new Promise((resolve) => {
          if (nodeResponse.destroyed) {
            resolve()
          } else {
            nodeResponse.once("close", () => {
              resolve()
            })
            nodeResponse.destroy()
          }
        })
      }),
    )
  }

  return { stop }
}
