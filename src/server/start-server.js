/* eslint-disable import/max-dependencies */
import { createServer as createNodeServer, STATUS_CODES } from "http"
import { createServer as createNodeSecureServer, Agent as SecureAgent } from "https"
import { memoizeOnce } from "@dmail/helper"
import {
  createCancellationToken,
  createOperation,
  createStoppableOperation,
} from "@dmail/cancellation"
import {
  registerProcessInterruptCallback,
  registerUnadvisedProcessCrashCallback,
  registerUngaranteedProcessTeardown,
} from "../process-signal/index.js"
import { trackConnections, trackClients, trackRequestHandlers } from "./trackers.js"
import { nodeRequestToRequest } from "./nodeRequestToRequest.js"
import { populateNodeResponse } from "./populateNodeResponse.js"
import { colorizeResponseStatus } from "./colorizeResponseStatus.js"
import { requestToAccessControlHeaders } from "./requestToAccessControlHeaders.js"
import { responseCompose } from "./responseCompose.js"
import { originAsString } from "./originAsString.js"
import { listen, stopListening } from "./listen.js"
import { createLogger, LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS } from "../logger.js"

const killPort = import.meta.require("kill-port")

const REASON_NOT_SPECIFIED = "not specified"
const REASON_INTERNAL_ERROR = "internal error"

// todo: provide an option like debugInternalError
// which sends error.stack on 500 to the client
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
  stopOnCrash = false,
  requestToResponse = () => null,
  cors = false,
  logLevel = LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS,
  startedCallback = () => {},
  stoppedCallback = () => {},
} = {}) => {
  if (port === 0 && forcePort) throw new Error(`no need to pass forcePort when port is 0`)
  if (protocol !== "http" && protocol !== "https")
    throw new Error(`protocol must be http or https, got ${protocol}`)
  // https://github.com/nodejs/node/issues/14900
  if (ip === "0.0.0.0" && process.platform === "win32")
    throw new Error(`listening ${ip} not available on window`)

  const { log, logError } = createLogger({ logLevel })

  if (forcePort) {
    await createOperation({
      cancellationToken,
      start: () => killPort(port),
    })
  }

  const { nodeServer, agent } = getNodeServerAndAgent({ protocol, signature })

  let status = "starting"

  const { registerCleanupCallback, cleanup } = createTracker()

  const connectionTracker = trackConnections(nodeServer)
  // opened connection must be shutdown before the close event is emitted
  registerCleanupCallback(connectionTracker.stop)

  const clientTracker = trackClients(nodeServer)
  registerCleanupCallback((reason) => {
    let responseStatus
    if (reasonIsInternalError(reason)) {
      responseStatus = 500
      // reason = 'shutdown because error'
    } else {
      responseStatus = 503
      // reason = 'unavailable because closing'
    }
    clientTracker.stop({ status: responseStatus, reason })
  })

  const requestHandlerTracker = trackRequestHandlers(nodeServer)
  // ensure we don't try to handle request while server is closing
  registerCleanupCallback(requestHandlerTracker.stop)

  let stoppedResolve
  const stoppedPromise = new Promise((resolve) => {
    stoppedResolve = resolve
  })
  const stop = memoizeOnce(async (reason = REASON_NOT_SPECIFIED) => {
    status = "closing"
    log(`server stopped because ${reason}`)

    await cleanup(reason)
    await stopListening(nodeServer)
    status = "stopped"
    stoppedCallback({ reason })
    stoppedResolve()
  })
  const startOperation = createStoppableOperation({
    cancellationToken,
    start: () => listen({ cancellationToken, server: nodeServer, port, ip }),
    stop: (_, reason) => stop(reason),
  })

  if (stopOnCrash) {
    const unregister = registerUnadvisedProcessCrashCallback((reason) => {
      stop(reason.value)
    })
    registerCleanupCallback(unregister)
  }

  if (stopOnError) {
    const unregister = requestHandlerTracker.add((nodeRequest, nodeResponse) => {
      if (nodeResponse.statusCode === 500 && reasonIsInternalError(nodeResponse.statusMessage)) {
        stop(REASON_INTERNAL_ERROR)
      }
    })
    registerCleanupCallback(unregister)
  }

  if (stopOnExit) {
    const unregister = registerUngaranteedProcessTeardown((reason) => {
      stop(`process ${reason}`)
    })
    registerCleanupCallback(unregister)
  }

  if (stopOnSIGINT) {
    const unregister = registerProcessInterruptCallback(() => {
      stop("process sigint")
    })
    registerCleanupCallback(unregister)
  }

  port = await startOperation
  status = "opened"
  const origin = originAsString({ protocol, ip, port })
  log(`server started at ${origin}`)
  startedCallback({ origin })

  // nodeServer.on("upgrade", (request, socket, head) => {
  //   // when being requested using a websocket
  //   // we could also answr to the request ?
  //   // socket.end([data][, encoding])

  //   console.log("upgrade", { head, request })
  //   console.log("socket", { connecting: socket.connecting, destroyed: socket.destroyed })
  // })

  if (cors) {
    const originalRequestToResponse = requestToResponse
    requestToResponse = async (request) => {
      const accessControlHeaders = requestToAccessControlHeaders(request)

      if (request.method === "OPTIONS") {
        return {
          status: 200,
          headers: {
            ...accessControlHeaders,
            "content-length": 0,
          },
        }
      }

      const response = await originalRequestToResponse(request)
      return responseCompose({ headers: accessControlHeaders }, response)
    }
  }

  requestHandlerTracker.add(async (nodeRequest, nodeResponse) => {
    const request = nodeRequestToRequest(nodeRequest, origin)

    nodeRequest.on("error", (error) => {
      logError("error on", request.ressource, error)
    })

    let response
    try {
      const generatedResponse = await requestToResponse(request)
      const { status = 501, statusText = statusToStatusText(status), headers = {}, body = "" } =
        generatedResponse || {}
      response = Object.freeze({ status, statusText, headers, body })

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
      const body = error && error.stack ? error.stack : error

      response = Object.freeze({
        status: 500,
        statusText: REASON_INTERNAL_ERROR,
        headers: {
          // ensure error are not cached
          "cache-control": "no-store",
          "content-type": "text/plain",
          "content-length": Buffer.byteLength(body),
        },
        body,
      })
    }

    log(`${request.method} ${request.origin}${request.ressource}`)
    log(`${colorizeResponseStatus(response.status)} ${response.statusText}`)
    if (response.status === 500) {
      log(response.body)
    }
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
    stoppedPromise,
  }
}

const createTracker = () => {
  const callbackArray = []

  const registerCleanupCallback = (callback) => {
    if (typeof callback !== "function")
      throw new TypeError(`callback must be a function
callback: ${callback}`)
    callbackArray.push(callback)
  }

  const cleanup = async (reason) => {
    const localCallbackArray = callbackArray.slice()
    await Promise.all(localCallbackArray.map((callback) => callback(reason)))
  }

  return { registerCleanupCallback, cleanup }
}

const statusToStatusText = (status) => STATUS_CODES[status] || "not specified"

const reasonIsInternalError = (reason) => reason === REASON_INTERNAL_ERROR

const getNodeServerAndAgent = ({ protocol, signature = {} }) => {
  if (protocol === "http") {
    return {
      nodeServer: createNodeServer(),
      agent: global.Agent,
    }
  }

  if (protocol === "https") {
    const { privateKey, certificate } = signature
    if (!privateKey || !certificate) {
      throw new Error(`missing signature for https server`)
    }

    return {
      nodeServer: createNodeSecureServer({
        key: privateKey,
        cert: certificate,
      }),
      agent: new SecureAgent({
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
