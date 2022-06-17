import http from "node:http"
import { Http2ServerResponse } from "node:http2"
import { raceCallbacks } from "@jsenv/abort"

import { normalizeBodyMethods } from "./body.js"

export const populateNodeResponse = async (
  responseStream,
  { status, statusText, headers, body, bodyEncoding },
  { signal, ignoreBody, onAbort, onError, onHeadersSent, onEnd } = {},
) => {
  body = await body
  const bodyMethods = normalizeBodyMethods(body)

  if (signal.aborted) {
    bodyMethods.destroy()
    responseStream.destroy()
    onAbort()
    return
  }

  writeHead(responseStream, {
    status,
    statusText,
    headers,
    onHeadersSent,
  })

  if (!body) {
    onEnd()
    responseStream.end()
    return
  }

  if (ignoreBody) {
    onEnd()
    bodyMethods.destroy()
    responseStream.end()
    return
  }

  if (bodyEncoding) {
    responseStream.setEncoding(bodyEncoding)
  }

  await new Promise((resolve) => {
    const observable = bodyMethods.asObservable()
    const subscription = observable.subscribe({
      next: (data) => {
        try {
          responseStream.write(data)
        } catch (e) {
          // Something inside Node.js sometimes puts stream
          // in a state where .write() throw despites nodeResponse.destroyed
          // being undefined and "close" event not being emitted.
          // I have tested if we are the one calling destroy
          // (I have commented every .destroy() call)
          // but issue still occurs
          // For the record it's "hard" to reproduce but can be by running
          // a lot of tests against a browser in the context of @jsenv/core testing
          if (e.code === "ERR_HTTP2_INVALID_STREAM") {
            return
          }
          responseStream.emit("error", e)
        }
      },
      error: (value) => {
        responseStream.emit("error", value)
      },
      complete: () => {
        responseStream.end()
      },
    })

    raceCallbacks(
      {
        abort: (cb) => {
          signal.addEventListener("abort", cb)
          return () => {
            signal.removeEventListener("abort", cb)
          }
        },
        error: (cb) => {
          responseStream.on("error", cb)
          return () => {
            responseStream.removeListener("error", cb)
          }
        },
        close: (cb) => {
          responseStream.on("close", cb)
          return () => {
            responseStream.removeListener("close", cb)
          }
        },
        finish: (cb) => {
          responseStream.on("finish", cb)
          return () => {
            responseStream.removeListener("finish", cb)
          }
        },
      },
      (winner) => {
        const raceEffects = {
          abort: () => {
            subscription.unsubscribe()
            responseStream.destroy()
            onAbort()
            resolve()
          },
          error: (error) => {
            subscription.unsubscribe()
            responseStream.destroy()
            onError(error)
            resolve()
          },
          close: () => {
            // close body in case nodeResponse is prematurely closed
            // while body is writing
            // it may happen in case of server sent event
            // where body is kept open to write to client
            // and the browser is reloaded or closed for instance
            subscription.unsubscribe()
            responseStream.destroy()
            onAbort()
            resolve()
          },
          finish: () => {
            onEnd()
            resolve()
          },
        }
        raceEffects[winner.name](winner.data)
      },
    )
  })
}

const writeHead = (
  responseStream,
  { status, statusText, headers, onHeadersSent },
) => {
  const responseIsHttp2ServerResponse =
    responseStream instanceof Http2ServerResponse
  const responseIsServerHttp2Stream =
    responseStream.constructor.name === "ServerHttp2Stream"
  let nodeHeaders = headersToNodeHeaders(headers, {
    // https://github.com/nodejs/node/blob/79296dc2d02c0b9872bbfcbb89148ea036a546d0/lib/internal/http2/compat.js#L112
    ignoreConnectionHeader:
      responseIsHttp2ServerResponse || responseIsServerHttp2Stream,
  })
  if (statusText === undefined) {
    statusText = statusTextFromStatus(status)
  }
  if (responseIsServerHttp2Stream) {
    nodeHeaders = {
      ...nodeHeaders,
      ":status": status,
    }
    responseStream.respond(nodeHeaders)
    onHeadersSent({ nodeHeaders, status, statusText })
    return
  }
  // nodejs strange signature for writeHead force this
  // https://nodejs.org/api/http.html#http_response_writehead_statuscode_statusmessage_headers
  if (
    // https://github.com/nodejs/node/blob/79296dc2d02c0b9872bbfcbb89148ea036a546d0/lib/internal/http2/compat.js#L97
    responseIsHttp2ServerResponse
  ) {
    responseStream.writeHead(status, nodeHeaders)
    onHeadersSent({ nodeHeaders, status, statusText })
    return
  }
  responseStream.writeHead(status, statusText, nodeHeaders)
  onHeadersSent({ nodeHeaders, status, statusText })
}

const statusTextFromStatus = (status) =>
  http.STATUS_CODES[status] || "not specified"

const headersToNodeHeaders = (headers, { ignoreConnectionHeader }) => {
  const nodeHeaders = {}

  Object.keys(headers).forEach((name) => {
    if (name === "connection" && ignoreConnectionHeader) return
    const nodeHeaderName = name in mapping ? mapping[name] : name
    nodeHeaders[nodeHeaderName] = headers[name]
  })

  return nodeHeaders
}

const mapping = {
  // "content-type": "Content-Type",
  // "last-modified": "Last-Modified",
}
