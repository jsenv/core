/* eslint-disable import/max-dependencies */
import http from "http"
import https from "https"
import killPort from "kill-port"
import { URL } from "url"
import { createCancellationToken, createStoppableOperation } from "@dmail/cancellation"
import { processTeardown } from "../process-teardown/index.js"
import { memoizeOnce } from "../functionHelper.js"
import { trackConnections, trackClients, trackRequestHandlers } from "./trackers.js"
import { nodeRequestToRequest } from "./nodeRequestToRequest.js"
import { populateNodeResponse } from "./populateNodeResponse.js"
import { registerProcessCrash } from "./registerProcessCrash.js"

const REASON_NOT_SPECIFIED = "not specified"
const REASON_INTERNAL_ERROR = "internal error"

export const originAsString = ({ protocol, ip, port }) => {
  const url = new URL("https://127.0.0.1:80")
  url.protocol = protocol
  url.hostname = ip
  url.port = port
  return url.origin
}

export const startServer = async ({
  cancellationToken = createCancellationToken(),
  protocol = "http",
  ip = "127.0.0.1",
  port = 0, // aasign a random available port
  forcePort = false,
  // when port is https you must provide { privateKey, certificate } under signature
  signature,
  stopOnSIGINT = true,
  // auto close the server when the process exits
  stopOnExit = true,
  // auto close when server respond with a 500
  stopOnError = true,
  // auto close the server when an uncaughtException happens
  // it mess up stack trace
  // and execute code on uncaughtException/unhandledRejection so
  // it should not be used at all
  stopOnCrash = false,
  requestToResponse = () => null,
  verbose = true,
  startedMessage = ({ origin }) => `server started at ${origin}`,
  stoppedMessage = (reason) => `server stopped because ${reason}`,
} = {}) => {
  if (port === 0 && forcePort) throw new Error(`no need to pass forcePort when port is 0`)
  if (protocol !== "http" && protocol !== "https")
    throw new Error(`protocol must be http or https, got ${protocol}`)
  // https://github.com/nodejs/node/issues/14900
  if (ip === "0.0.0.0" && process.platform === "win32")
    throw new Error(`listening ${ip} not available on window`)

  const log = (...args) => {
    if (verbose) {
      console.log(...args)
    }
  }

  cancellationToken.throwIfRequested()
  await (forcePort ? killPort(port) : Promise.resolve())
  cancellationToken.throwIfRequested()

  const { nodeServer, agent } = getNodeServerAndAgent({ protocol, signature })

  let status = "starting"

  const connectionTracker = trackConnections(nodeServer)
  const clientTracker = trackClients(nodeServer)
  const requestHandlerTracker = trackRequestHandlers(nodeServer)

  let stoppingResolve
  const stopping = new Promise((resolve) => {
    stoppingResolve = resolve
  })
  let stoppedResolve
  const stopped = new Promise((resolve) => {
    stoppedResolve = resolve
  })
  const stop = memoizeOnce(async (reason = REASON_NOT_SPECIFIED) => {
    stoppingResolve(reason)
    status = "closing"
    log(stoppedMessage(reason))

    let responseStatus
    if (reasonIsInternalError(reason)) {
      responseStatus = 500
      // reason = 'shutdown because error'
    } else {
      responseStatus = 503
      // reason = 'unavailable because closing'
    }

    // ensure we don't try to handle request while server is closing
    requestHandlerTracker.stop(reason)
    // opened connection must be shutdown before the close event is emitted
    await clientTracker.stop({ status: responseStatus, reason })
    await connectionTracker.stop(reason)
    await listenStop(nodeServer)
    status = "stopped"
    stoppedResolve()
  })
  const startOperation = createStoppableOperation({
    cancellationToken,
    start: () => listen({ cancellationToken, server: nodeServer, port, ip }),
    stop: (_, reason) => stop(reason),
  })

  const stopRequestedPromises = []
  if (stopOnCrash) {
    const stopRequestedByCrash = new Promise((resolve) => {
      const unregister = registerProcessCrash((reason) => {
        resolve(reason.value)
      })
      stopping.then(unregister)
    })
    stopRequestedPromises.push(stopRequestedByCrash)
  }
  if (stopOnError) {
    const stopRequestedByError = new Promise((resolve) => {
      const unregister = requestHandlerTracker.add((nodeRequest, nodeResponse) => {
        if (nodeResponse.statusCode === 500 && reasonIsInternalError(nodeResponse.statusMessage)) {
          resolve("server internal error")
        }
      })
      stopping.then(unregister)
    })
    stopRequestedPromises.push(stopRequestedByError)
  }
  if (stopOnExit) {
    const stopRequestedByExit = new Promise((resolve) => {
      const unregister = processTeardown((reason) => {
        resolve(`server process ${reason}`)
      })
      stopping.then(unregister)
    })
    stopRequestedPromises.push(stopRequestedByExit)
  }
  if (stopOnSIGINT) {
    const stopRequestedBySIGINT = new Promise((resolve) => {
      const onsigint = () => resolve("process sigint")
      process.once("SIGINT", onsigint)
      stopping.then(() => {
        process.removeListener("SIGINT", onsigint)
      })
    })
    stopRequestedPromises.push(stopRequestedBySIGINT)
  }
  Promise.race(stopRequestedPromises).then(stop)

  port = await startOperation
  status = "opened"
  const origin = originAsString({ protocol, ip, port })
  log(startedMessage({ origin }))

  // nodeServer.on("upgrade", (request, socket, head) => {
  //   // when being requested using a websocket
  //   // we could also answr to the request ?
  //   // socket.end([data][, encoding])

  //   console.log("upgrade", { head, request })
  //   console.log("socket", { connecting: socket.connecting, destroyed: socket.destroyed })
  // })

  requestHandlerTracker.add(async (nodeRequest, nodeResponse) => {
    const request = nodeRequestToRequest(nodeRequest, origin)
    log(`${request.method} ${request.origin}/${request.ressource}`)

    nodeRequest.on("error", (error) => {
      log("error on", request.ressource, error)
    })

    let response
    try {
      const {
        status = 501,
        reason = "not specified",
        headers = {},
        body = "",
      } = await requestToResponse(request)
      response = Object.freeze({ status, reason, headers, body })

      if (
        request.method !== "HEAD" &&
        response.headers["content-length"] > 0 &&
        response.body === ""
      ) {
        throw createContentLengthMismatchError(
          `content-length header is ${response.headers["content-length"]} but body is empty`,
        )
      }
    } catch (error) {
      response = Object.freeze({
        status: 500,
        reason: REASON_INTERNAL_ERROR,
        headers: {},
        body: error && error.stack ? error.stack : error,
      })
    }

    log(`${response.status} ${request.origin}/${request.ressource}`)
    populateNodeResponse(nodeResponse, response, {
      ignoreBody: request.method === "HEAD",
    })
  })

  return {
    getStatus: () => status,
    origin,
    nodeServer,
    agent,
    stop,
    stopped,
  }
}

export const listen = ({ cancellationToken, server, port, ip }) => {
  return createStoppableOperation({
    cancellationToken,
    start: () => listenStart(server, port, ip),
    stop: () => listenStop(server),
  })
}

const listenStart = (server, port, ip) =>
  new Promise((resolve, reject) => {
    server.on("error", reject)
    server.on("listening", () => {
      // in case port is 0 (randomly assign an available port)
      // https://nodejs.org/api/net.html#net_server_listen_port_host_backlog_callback
      resolve(server.address().port)
    })
    server.listen(port, ip)
  })

const listenStop = (server) =>
  new Promise((resolve, reject) => {
    server.on("error", reject)
    server.on("close", resolve)
    server.close()
  })

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
