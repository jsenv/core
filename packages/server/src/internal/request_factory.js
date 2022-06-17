import { nodeStreamToObservable } from "./nodeStreamToObservable.js"
import { headersFromObject } from "./headersFromObject.js"

export const fromNodeRequest = (nodeRequest, { serverOrigin, signal }) => {
  const headers = headersFromObject(nodeRequest.headers)
  const body = nodeStreamToObservable(nodeRequest)

  let requestOrigin
  if (nodeRequest.authority) {
    requestOrigin = nodeRequest.connection.encrypted
      ? `https://${nodeRequest.authority}`
      : `http://${nodeRequest.authority}`
  } else if (nodeRequest.headers.host) {
    requestOrigin = nodeRequest.connection.encrypted
      ? `https://${nodeRequest.headers.host}`
      : `http://${nodeRequest.headers.host}`
  } else {
    requestOrigin = serverOrigin
  }

  return Object.freeze({
    signal,
    http2: Boolean(nodeRequest.stream),
    origin: requestOrigin,
    ...getPropertiesFromRessource({
      ressource: nodeRequest.url,
      baseUrl: requestOrigin,
    }),
    method: nodeRequest.method,
    headers,
    body,
  })
}

export const applyRedirectionToRequest = (
  request,
  { ressource, pathname, ...rest },
) => {
  return {
    ...request,
    ...(ressource
      ? getPropertiesFromRessource({
          ressource,
          baseUrl: request.url,
        })
      : pathname
      ? getPropertiesFromPathname({
          pathname,
          baseUrl: request.url,
        })
      : {}),
    ...rest,
  }
}

const getPropertiesFromRessource = ({ ressource, baseUrl }) => {
  const urlObject = new URL(ressource, baseUrl)
  let pathname = urlObject.pathname

  return {
    url: String(urlObject),
    pathname,
    ressource,
  }
}

const getPropertiesFromPathname = ({ pathname, baseUrl }) => {
  return getPropertiesFromRessource({
    ressource: `${pathname}${new URL(baseUrl).search}`,
    baseUrl,
  })
}

export const createPushRequest = (request, { signal, pathname, method }) => {
  const pushRequest = Object.freeze({
    ...request,
    parent: request,
    signal,
    http2: true,
    ...(pathname
      ? getPropertiesFromPathname({
          pathname,
          baseUrl: request.url,
        })
      : {}),
    method: method || request.method,
    headers: getHeadersInheritedByPushRequest(request),
    body: undefined,
  })
  return pushRequest
}

const getHeadersInheritedByPushRequest = (request) => {
  const headersInherited = { ...request.headers }
  // mtime sent by the client in request headers concerns the main request
  // Time remains valid for request to other ressources so we keep it
  // in child requests
  // delete childHeaders["if-modified-since"]

  // eTag sent by the client in request headers concerns the main request
  // A request made to an other ressource must not inherit the eTag
  delete headersInherited["if-none-match"]

  return headersInherited
}
