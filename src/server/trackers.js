export const trackConnections = (nodeServer) => {
  const connections = new Set()

  const connectionListener = (connection) => {
    connection.on("close", () => {
      connections.delete(connection)
    })
    connections.add(connection)
  }

  nodeServer.on("connection", connectionListener)

  const close = (reason) => {
    nodeServer.removeListener("connection", connectionListener)

    // should we do this async ?
    // should we do this before closing the server ?
    connections.forEach((connection) => {
      connection.destroy(reason)
    })
  }

  return { close }
}

export const trackClients = (nodeServer) => {
  const clients = new Set()

  const clientListener = (nodeRequest, nodeResponse) => {
    const client = { nodeRequest, nodeResponse }

    clients.add(client)
    nodeResponse.on("finish", () => {
      clients.delete(client)
    })
  }

  nodeServer.on("request", clientListener)

  const close = ({ status, reason }) => {
    nodeServer.removeListener("request", clientListener)

    return Promise.all(
      Array.from(clients).map(({ nodeResponse }) => {
        if (nodeResponse.headersSent === false) {
          nodeResponse.writeHead(status, reason)
        }

        return new Promise((resolve) => {
          if (nodeResponse.finished === false) {
            nodeResponse.on("finish", resolve)
            nodeResponse.on("error", resolve)
            nodeResponse.destroy(reason)
          } else {
            resolve()
          }
        })
      }),
    )
  }

  return { close }
}

export const trackRequestHandlers = (nodeServer) => {
  const requestHandlers = []
  const add = (handler) => {
    requestHandlers.push(handler)
    nodeServer.on("request", handler)
    return () => {
      nodeServer.removeListener("request", handler)
    }
  }

  const close = () => {
    requestHandlers.forEach((requestHandler) => {
      nodeServer.removeListener("request", requestHandler)
    })
    requestHandlers.length = 0
  }

  return { add, close }
}
