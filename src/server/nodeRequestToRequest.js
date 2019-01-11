import { nodeStreamToObservable } from "./nodeStreamToObservable.js"
import { headersFromObject } from "./headers.js"

export const nodeRequestToRequest = (nodeRequest, origin) => {
  const ressource = nodeRequest.url.slice(1)
  const { method } = nodeRequest
  const headers = headersFromObject(nodeRequest.headers)
  const body =
    method === "POST" || method === "PUT" || method === "PATCH"
      ? nodeStreamToObservable(nodeRequest)
      : undefined

  return Object.freeze({
    origin,
    ressource,
    method,
    headers,
    body,
  })
}
