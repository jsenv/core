import http from "http"
import https from "https"
import { URL } from "url"
import { createSelfSignature } from "./createSelfSignature.js"
import { processTeardown } from "./processTeardown.js"
import { createRequestFromNodeRequest } from "./createRequestFromNodeRequest.js"
import { populateNodeResponse } from "./populateNodeResponse.js"
import { createSignal } from "@dmail/signal"
import killPort from "kill-port"

const REASON_CLOSING = "closing"

export const openServer = (
  {
    // by default listen localhost on a random port in https
    url = "https://127.0.0.1:0",
    forcePort = false,
    // when port is https you must provide privateKey & certificate
    getSignature = createSelfSignature,
    // auto close the server when the process exits (terminal closed, ctrl + C, ...)
    autoCloseOnExit = true,
    // auto close the server when an uncaughtException happens
    // false by default because evenwith my strategy to react on uncaughtException
    // stack trace is messed up and I don't like to have code executed on error
    autoCloseOnCrash = true,
    // auto close when server respond with a 500
    autoCloseOnError = true,
    getResponseForRequest = () => ({ status: 501 }),
  } = {},
) => {
  url = new URL(url)

  const protocol = url.protocol
  const hostname = url.hostname

  if (hostname === "0.0.0.0" && process.platform === "win32") {
    // https://github.com/nodejs/node/issues/14900
    throw new Error(`listening ${hostname} any not available on window`)
  }

  let nodeServer
  let agent
  if (protocol === "http:") {
    nodeServer = http.createServer()
    agent = global.Agent
  } else if (protocol === "https:") {
    const { privateKey, certificate } = getSignature()
    nodeServer = https.createServer({
      key: privateKey,
      cert: certificate,
    })
    agent = new https.Agent({
      rejectUnauthorized: false, // allow self signed certificate
    })
  } else {
    throw new Error(`unsupported protocol ${protocol}`)
  }

  const port = url.port

  const connections = new Set()
  nodeServer.on("connection", (connection) => {
    connection.on("close", () => {
      connections.delete(connection)
    })
    connections.add(connection)
  })

  const requestHandlers = []
  const addInternalRequestHandler = (handler) => {
    requestHandlers.push(handler)
    nodeServer.on("request", handler)
    return () => {
      nodeServer.removeListener("request", handler)
    }
  }

  const clients = new Set()

  const closeClients = ({ isError, reason }) => {
    let status
    if (isError) {
      status = 500
      // reason = 'shutdown because error'
    } else {
      status = 503
      // reason = 'unavailable because closing'
    }

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

  addInternalRequestHandler((nodeRequest, nodeResponse) => {
    const client = { nodeRequest, nodeResponse }

    clients.add(client)
    nodeResponse.on("finish", () => {
      clients.delete(client)
    })
  })

  // nodeServer.on("upgrade", (request, socket, head) => {
  //   // when being requested using a websocket
  //   // we could also answr to the request ?
  //   // socket.end([data][, encoding])

  //   console.log("upgrade", { head, request })
  //   console.log("socket", { connecting: socket.connecting, destroyed: socket.destroyed })
  // })

  let status = "opening"

  const listen = () => {
    return new Promise((resolve, reject) => {
      nodeServer.listen(port, hostname, (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  const closed = createSignal()

  return Promise.resolve()
    .then(() => (forcePort ? killPort(port) : null))
    .then(() => listen())
    .then(() => {
      status = "opened"

      // in case port is 0 (randomly assign an available port)
      // https://nodejs.org/api/net.html#net_server_listen_port_host_backlog_callback
      const port = nodeServer.address().port
      url.port = port

      addInternalRequestHandler((nodeRequest, nodeResponse) => {
        const request = createRequestFromNodeRequest(nodeRequest, url)
        console.log(request.method, request.url.toString())

        nodeRequest.on("error", (error) => {
          console.log("error on", request.url.toString(), error)
        })

        return Promise.resolve()
          .then(() => getResponseForRequest(request))
          .catch((error) => {
            return {
              status: 500,
              reason: "internal error",
              body: error && error.stack ? error.stack : error,
            }
          })
          .then((finalResponse) => {
            console.log(`${finalResponse.status} ${request.url}`)
            populateNodeResponse(nodeResponse, finalResponse, {
              ignoreBody: request.method === "HEAD",
            })
          })
      })

      const closeConnections = (reason) => {
        // should we do this async ?
        // should we do this before closing the server ?
        connections.forEach((connection) => {
          connection.destroy(reason)
        })
      }

      let close = ({ isError = false, reason = REASON_CLOSING } = {}) => {
        if (status !== "opened") {
          throw new Error(`server status must be "opened" during close() (got ${status}`)
        }

        // ensure we don't try to handle request while server is closing
        requestHandlers.forEach((requestHandler) => {
          nodeServer.removeListener("request", requestHandler)
        })
        requestHandlers.length = 0

        status = "closing"

        return new Promise((resolve, reject) => {
          // closing server prevent it from accepting new connections
          // but opened connection must be shutdown before the close event is emitted
          nodeServer.once("close", (error) => {
            if (error) {
              reject(error)
            } else {
              resolve()
            }
          })
          nodeServer.close()
          closeClients({ isError, reason }).then(() => {
            closeConnections(reason)
          })
        }).then(() => {
          status = "closed"
          closed.emit()
        })
      }

      if (autoCloseOnError) {
        const removeAutoCloseOnError = addInternalRequestHandler((nodeRequest, nodeResponse) => {
          if (nodeResponse.statusCode === 500) {
            close({
              isError: true,
              // we don't specify the true error object but only a string
              // identifying the error to avoid sending stacktrace to client
              // and right now there is no clean way to retrieve error from here
              reason: nodeResponse.statusMessage || "internal error",
            })
          }
        })
        const wrappedClose = close
        close = (...args) => {
          removeAutoCloseOnError()
          return wrappedClose(...args)
        }
      }

      if (autoCloseOnExit) {
        const removeTeardown = processTeardown((exitReason) => {
          console.log("close server on process teardown")
          close({ reason: `server process exiting ${exitReason}` })
        })
        const wrappedClose = close
        close = (...args) => {
          removeTeardown()
          return wrappedClose(...args)
        }
      }

      if (autoCloseOnCrash) {
        // and if we do that we have to remove the listener
        // while closing to avoid closing twice in case
        // addNodeExceptionHandler((exception) => {
        //   return close({ reason: exception }).then(
        //     // to indicates exception is not handled
        //     () => false,
        //   )
        // })
      }

      return {
        url,
        nodeServer,
        agent,
        close,
        closed,
      }
    })
}

export const listenRequest = (nodeServer, requestHandler) => {
  nodeServer.on("request", requestHandler)
}
