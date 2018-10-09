// https://github.com/jsenv/core/tree/master/src/util/rest

import { URL } from "url"
import { createBody, pipe } from "./createConnection/index.js"
import { headersFromObject, headersCompose } from "./headers.js"

// serverURL pourrait valoir par défaut `file:///${process.cwd()}` ?
export const createRequestFromNodeRequest = (nodeRequest, serverURL) => {
  const { method } = nodeRequest
  const url = new URL(nodeRequest.url, serverURL)
  const headers = headersFromObject(nodeRequest.headers)
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

export const populateNodeResponse = (
  nodeResponse,
  { status, reason, headers, body },
  { ignoreBody },
) => {
  nodeResponse.writeHead(status, reason, headers)
  if (ignoreBody) {
    nodeResponse.end()
  } else {
    pipe(createBody(body), nodeResponse)
  }
}

export const createNodeRequestHandler = ({ handler, url }) => {
  return (nodeRequest, nodeResponse) => {
    // should have some kind of id for a request
    // so that logs knows whichs request they belong to
    const request = createRequestFromNodeRequest(nodeRequest, url)
    console.log(request.method, request.url.toString())

    nodeRequest.on("error", (error) => {
      console.log("error on", request.url.toString(), error)
    })

    return Promise.resolve()
      .then(() => handler(request))
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
  }
}

// https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
export const enableCORS = (
  request,
  response,
  {
    allowedOrigins = [request.headers.origin],
    allowedMethods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders = ["x-requested-with", "content-type", "accept"],
  } = {},
) => {
  const corsHeaders = {
    "access-control-allow-origin": allowedOrigins.join(", "),
    "access-control-allow-methods": allowedMethods.join(", "),
    "access-control-allow-headers": allowedHeaders.join(", "),
    "access-control-allow-credentials": true,
    "access-control-max-age": 1, // Seconds
    vary: "Origin",
  }

  return {
    ...response,
    headers: headersCompose(corsHeaders, response.headers),
  }
}
