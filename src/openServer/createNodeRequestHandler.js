// https://github.com/jsenv/core/tree/master/src/util/rest

import { URL } from "url"
import { createBody } from "./createBody.js"
import { createHeaders } from "./createHeaders.js"
import { createSignal } from "@dmail/signal"

// serverURL pourrait valoir par défaut `file:///${process.cwd()}` ?
export const createRequestFromNodeRequest = (nodeRequest, serverURL) => {
  const { method } = nodeRequest
  const url = new URL(nodeRequest.url, serverURL)
  const headers = createHeaders(nodeRequest.headers)
  const body = createBody(
    method === "POST" || method === "PUT" || method === "PATCH" ? nodeRequest : undefined,
  )

  return Object.freeze({
    method,
    url,
    headers,
    body,
  })
}

export const populateNodeResponse = (nodeResponse, { status, reason = "", headers, body }) => {
  const headerAsJSON = headers.toJSON()
  nodeResponse.writeHead(status, reason, headerAsJSON)

  body.pipeTo(nodeResponse)
  if (body.willAutoClose === false && headers.get("connection") !== "keep-alive") {
    body.close()
  }
}

const createResponse = (
  { method },
  { status = 501, reason, headers = createHeaders(), body = createBody() } = {},
) => {
  if (method === "HEAD") {
    // don't send body for HEAD requests
    body = createBody()
  } else {
    body = createBody(body)
  }

  headers = createHeaders(headers)

  return Object.freeze({ status, reason, headers, body })
}

export const createNodeRequestHandler = ({ handler, transform = (response) => response, url }) => {
  return (nodeRequest, nodeResponse) => {
    const closed = createSignal({ smart: true })
    nodeResponse.once("close", () => closed.emit())

    // should have some kind of id for a request
    // so that logs knows whichs request they belong to
    const request = createRequestFromNodeRequest(nodeRequest, url)
    console.log(request.method, request.url.toString())

    nodeRequest.on("error", (error) => {
      console.log("error on", request.url.toString(), error)
    })

    return Promise.resolve()
      .then(() => {
        return handler(request)
      })
      .then((responseProperties) => {
        const response = createResponse(request, responseProperties)
        return transform(response)
      })
      .catch((error) => {
        return createResponse(request, {
          status: 500,
          reason: "internal error",
          body: error && error.stack ? error.stack : error,
        })
      })
      .then((finalResponse) => {
        console.log(`${finalResponse.status} ${request.url}`)
        // ensure body is closed when client is closed
        closed.listen(() => {
          finalResponse.body.close()
        })
        populateNodeResponse(nodeResponse, finalResponse)
      })
  }
}

export const enableCORS = (response) => {
  const corsHeaders = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"].join(", "),
    "access-control-allow-headers": ["x-requested-with", "content-type", "accept"].join(", "),
    "access-control-max-age": 1, // Seconds
  }

  const headersWithCORS = createHeaders(response.headers)
  Object.keys(corsHeaders).forEach((corsHeaderName) => {
    if (response.headers.has(corsHeaderName) === false) {
      // we should merge any existing response cors headers with the one above
      headersWithCORS.append(corsHeaderName, corsHeaders[corsHeaderName])
    }
  })

  return {
    ...response,
    headers: headersWithCORS,
  }
}
