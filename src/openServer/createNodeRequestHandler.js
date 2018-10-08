// https://github.com/jsenv/core/tree/master/src/util/rest

import { URL } from "url"
import { createBody, pipe } from "./createConnection/index.js"
import { headersFromObject } from "./headers.js"

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

export const enableCORS = (response) => {
  const corsHeaders = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"].join(", "),
    "access-control-allow-headers": ["x-requested-with", "content-type", "accept"].join(", "),
    "access-control-max-age": 1, // Seconds
  }

  return {
    ...response,
    headers: {
      ...corsHeaders,
      ...response.headers,
    },
  }
}
