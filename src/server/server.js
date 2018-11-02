/* eslint-disable import/max-dependencies */
import http from "http"
import https from "https"
import { processTeardown } from "../process-teardown/index.js"
import { createRequestFromNodeRequest } from "./createRequestFromNodeRequest.js"
import { populateNodeResponse } from "./populateNodeResponse.js"
import { createSignal } from "@dmail/signal"
import killPort from "kill-port"
import { URL } from "url"
import { cancellationNone } from "../cancel/index.js"
import { eventRace, registerEvent } from "../eventHelper.js"
import { processUnhandledException } from "./processUnhandledException.js"

const REASON_CLOSING = "closing"
const REASON_INTERNAL_ERROR = "internal error"

const reasonIsInternalError = (reason) => reason === REASON_INTERNAL_ERROR

const getNodeServerAndAgent = ({ protocol, signature = {} }) => {
  if (protocol === "http") {
    return {
      nodeServer: http.createServer(),
      agent: global.Agent,
    }
  }

  if (protocol === "https") {
    const { privateKey, certificate } = signature
    if (!privateKey || !certificate) {
      throw new Error(`missing signature for https server`)
    }

    return {
      nodeServer: https.createServer({
        key: privateKey,
        cert: certificate,
      }),
      agent: new https.Agent({
        rejectUnauthorized: false, // allow self signed certificate
      }),
    }
  }

  throw new Error(`unsupported protocol ${protocol}`)
}

const createContentLengthMismatchError = (message) => {
  const error = new Error(message)
  error.code = "CONTENT_LENGTH_MISMATCH"
  error.name = error.code
  return error
}

const trackConnections = (nodeServer) => {
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

const trackClients = (nodeServer) => {
  const clients = new Set()

  const clientListener = (nodeRequest, nodeResponse) => {
    const client = { nodeRequest, nodeResponse }

    clients.add(client)
    nodeResponse.on("finish", () => {
      clients.delete(client)
    })
  }

  nodeServer.on("request", clientListener)

  const close = (reason) => {
    nodeServer.removeListener("request", clientListener)

    let status
    if (reasonIsInternalError(reason)) {
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

  return { close }
}

const trackRequestHandlers = (nodeServer) => {
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

export const closeJustAfterListen = (server) => {
  return new Promise((resolve, reject) => {
    registerEvent(server, "close", (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
    server.close()
  })
}

export const listen = ({ cancellation = cancellationNone, server, port, ip }) => {
  return new Promise((resolve, reject) => {
    eventRace({
      cancel: {
        register: cancellation.register,
        callback: async () => {
          // we must wait for the server to be listening before being able to close it
          await new Promise((resolve) => {
            registerEvent(server, "listening", resolve)
          })
          return closeJustAfterListen(server)
        },
      },
      error: {
        register: (callback) => registerEvent(server, "error", callback),
        callback: reject,
      },
      listen: {
        register: (callback) => registerEvent(server, "listening", callback),
        // in case port is 0 (randomly assign an available port)
        // https://nodejs.org/api/net.html#net_server_listen_port_host_backlog_callback
        callback: () => resolve(server.address().port),
      },
    })

    server.listen(port, ip)
  })
}

export const originAsString = ({ protocol, ip, port }) => {
  const url = new URL("https://127.0.0.1:80")
  url.protocol = protocol
  url.hostname = ip
  url.port = port
  return url.origin
}

export const open = async (
  {
    cancellation = cancellationNone,
    protocol = "http",
    ip = "127.0.0.1",
    port = 0, // aasign a random available port
    forcePort = false,
    // when port is https you must provide { privateKey, certificate } under signature
    signature,
    // auto close the server when the process exits
    autoCloseOnExit = true,
    // auto close when server respond with a 500
    autoCloseOnError = true,
    // auto close the server when an uncaughtException happens
    // false by default because stack trace is messed up
    // and I don't like to have code executed on error
    // and the processUnhandledException implementation is a bit old
    // and complex. it would deserve a rewrite
    autoCloseOnCrash = false,
    requestToResponse = () => null,
    verbose = true,
    openedMessage = ({ origin }) => `server listening at ${origin}`,
    closedMessage = (reason) => `server closed because ${reason}`,
  } = {},
) => {
  if (port === 0 && forcePort) {
    throw new Error(`no need to pass forcePort when port is 0`)
  }
  if (protocol !== "http" && protocol !== "https") {
    throw new Error(`protocol must be http or https, got ${protocol}`)
  }
  if (ip === "0.0.0.0" && process.platform === "win32") {
    // https://github.com/nodejs/node/issues/14900
    throw new Error(`listening ${ip} not available on window`)
  }

  const log = (...args) => {
    if (verbose) {
      console.log(...args)
    }
  }

  await cancellation.toPromise()
  await (forcePort ? killPort(port) : Promise.resolve())
  await cancellation.toPromise()

  const { nodeServer, agent } = getNodeServerAndAgent({ protocol, signature })

  let status = "opening"
  port = await listen({ cancellation, server: nodeServer, port, ip })
  status = "opened"

  const origin = originAsString({ protocol, ip, port })
  log(openedMessage({ origin }))

  // nodeServer.on("upgrade", (request, socket, head) => {
  //   // when being requested using a websocket
  //   // we could also answr to the request ?
  //   // socket.end([data][, encoding])

  //   console.log("upgrade", { head, request })
  //   console.log("socket", { connecting: socket.connecting, destroyed: socket.destroyed })
  // })

  const connectionTracker = trackConnections(nodeServer)
  const clientTracker = trackClients(nodeServer)
  const requestHandlerTracker = trackRequestHandlers(nodeServer)
  const closed = createSignal()
  const closeSignal = createSignal()

  const close = (reason = REASON_CLOSING) => {
    if (status !== "opened") {
      throw new Error(`server status must be "opened" during close(), got ${status}`)
    }
    closeSignal.emit()
    status = "closing"

    log(closedMessage(reason))
    // ensure we don't try to handle request while server is closing
    requestHandlerTracker.close(reason)

    return new Promise((resolve, reject) => {
      nodeServer.once("close", (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
      // close prevent server from accepting new connections
      nodeServer.close()
      clientTracker.close(reason).then(() => {
        // opened connection must be shutdown before the close event is emitted
        connectionTracker.close(reason)
      })
    }).then(() => {
      status = "closed"
      closed.emit()
    })
  }

  eventRace({
    cancel: {
      register: cancellation.register,
      callback: close,
    },
    close: {
      register: (callback) => {
        const listener = closeSignal.listen(callback)
        return () => listener.remove()
      },
      callback: () => {
        // noop it's just to prevent close from being auto called
        // or called during cancel when it was already called
      },
    },
    ...(autoCloseOnError
      ? {
          error: {
            register: (callback) => {
              return requestHandlerTracker.add((nodeRequest, nodeResponse) => {
                if (
                  nodeResponse.statusCode === 500 &&
                  reasonIsInternalError(nodeResponse.statusMessage)
                ) {
                  callback("server internal error")
                }
              })
            },
            callback: close,
          },
        }
      : {}),
    ...(autoCloseOnExit
      ? {
          exit: {
            register: (callback) => {
              return processTeardown((reason) => callback(`server process ${reason}`))
            },
            callback: close,
          },
        }
      : {}),
    ...(autoCloseOnCrash
      ? {
          crash: {
            register: (callback) => {
              return processUnhandledException(() => {
                callback()
                return false // exception is not handled
              })
            },
            callback: close,
          },
        }
      : {}),
  })

  requestHandlerTracker.add((nodeRequest, nodeResponse) => {
    const request = createRequestFromNodeRequest(nodeRequest, origin)
    log(`${request.method} ${origin}/${request.ressource}`)

    nodeRequest.on("error", (error) => {
      log("error on", request.ressource, error)
    })

    return Promise.resolve()
      .then(() => requestToResponse(request))
      .then(({ status = 501, reason = "not specified", headers = {}, body = "" }) =>
        Object.freeze({ status, reason, headers, body }),
      )
      .then((response) => {
        if (
          request.method !== "HEAD" &&
          response.headers["content-length"] > 0 &&
          response.body === ""
        ) {
          throw createContentLengthMismatchError(
            `content-length header is ${response.headers["content-length"]} but body is empty`,
          )
        }

        return response
      })
      .catch((error) => {
        return Object.freeze({
          status: 500,
          reason: REASON_INTERNAL_ERROR,
          headers: {},
          body: error && error.stack ? error.stack : error,
        })
      })
      .then((response) => {
        log(`${response.status} ${origin}/${request.ressource}`)

        return populateNodeResponse(nodeResponse, response, {
          ignoreBody: request.method === "HEAD",
        })
      })
  })

  return {
    origin,
    nodeServer,
    agent,
    close,
    closed,
  }
}
