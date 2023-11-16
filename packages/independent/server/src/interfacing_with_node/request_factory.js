import { observableFromNodeStream } from "./observable_from_node_stream.js";
import { headersFromObject } from "../internal/headersFromObject.js";

export const fromNodeRequest = (
  nodeRequest,
  { serverOrigin, signal, requestBodyLifetime },
) => {
  const headers = headersFromObject(nodeRequest.headers);
  const body = observableFromNodeStream(nodeRequest, {
    readableStreamLifetime: requestBodyLifetime,
  });

  let requestOrigin;
  if (nodeRequest.upgrade) {
    requestOrigin = serverOrigin;
  } else if (nodeRequest.authority) {
    requestOrigin = nodeRequest.connection.encrypted
      ? `https://${nodeRequest.authority}`
      : `http://${nodeRequest.authority}`;
  } else if (nodeRequest.headers.host) {
    requestOrigin = nodeRequest.connection.encrypted
      ? `https://${nodeRequest.headers.host}`
      : `http://${nodeRequest.headers.host}`;
  } else {
    requestOrigin = serverOrigin;
  }

  return Object.freeze({
    signal,
    http2: Boolean(nodeRequest.stream),
    origin: requestOrigin,
    ...getPropertiesFromResource({
      resource: nodeRequest.url,
      baseUrl: requestOrigin,
    }),
    method: nodeRequest.method,
    headers,
    body,
  });
};

export const applyRedirectionToRequest = (
  request,
  { resource, pathname, ...rest },
) => {
  return {
    ...request,
    ...(resource
      ? getPropertiesFromResource({
          resource,
          baseUrl: request.url,
        })
      : pathname
        ? getPropertiesFromPathname({
            pathname,
            baseUrl: request.url,
          })
        : {}),
    ...rest,
  };
};

const getPropertiesFromResource = ({ resource, baseUrl }) => {
  const urlObject = new URL(resource, baseUrl);
  let pathname = urlObject.pathname;

  return {
    url: String(urlObject),
    searchParams: urlObject.searchParams,
    pathname,
    resource,
  };
};

const getPropertiesFromPathname = ({ pathname, baseUrl }) => {
  return getPropertiesFromResource({
    resource: `${pathname}${new URL(baseUrl).search}`,
    baseUrl,
  });
};

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
  });
  return pushRequest;
};

const getHeadersInheritedByPushRequest = (request) => {
  const headersInherited = { ...request.headers };
  // mtime sent by the client in request headers concerns the main request
  // Time remains valid for request to other resources so we keep it
  // in child requests
  // delete childHeaders["if-modified-since"]

  // eTag sent by the client in request headers concerns the main request
  // A request made to an other resource must not inherit the eTag
  delete headersInherited["if-none-match"];

  return headersInherited;
};
