import { createBody } from "./createConnection/index.js"
import { headersFromObject } from "./headers.js"

// serverURL pourrait valoir par défaut `file:///${process.cwd()}` ?
export const createRequestFromNodeRequest = (nodeRequest) => {
  const ressource = nodeRequest.url.slice(1)
  const { method } = nodeRequest
  const headers = headersFromObject(nodeRequest.headers)
  const body = createBody(
    method === "POST" || method === "PUT" || method === "PATCH" ? nodeRequest : undefined,
  )

  return Object.freeze({
    ressource,
    method,
    headers,
    body,
  })
}
