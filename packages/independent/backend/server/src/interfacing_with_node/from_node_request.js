import { Abort } from "@jsenv/abort";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";
import { parse } from "node:querystring";
import { headersFromObject } from "../internal/headersFromObject.js";
import { parseSingleHeaderWithAttributes } from "../internal/multiple-header.js";
import { observableFromNodeStream } from "./observable_from_node_stream.js";

export const fromNodeRequest = (
  nodeRequest,
  { serverOrigin, signal, requestBodyLifetime },
) => {
  const handleRequestOperation = Abort.startOperation();
  if (signal) {
    handleRequestOperation.addAbortSignal(signal);
  }
  handleRequestOperation.addAbortSource((abort) => {
    nodeRequest.once("close", abort);
    return () => {
      nodeRequest.removeListener("close", abort);
    };
  });

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

  // check the following parsers if we want to support more request body content types
  // https://github.com/node-formidable/formidable/tree/master/src/parsers
  const buffer = async () => {
    // here we don't really need to warn, one might want to read anything as binary
    // const contentType = headers["content-type"];
    // if (!CONTENT_TYPE.isBinary(contentType)) {
    //   console.warn(
    //     `buffer() called on a request with content-type: "${contentType}". A binary content-type was expected.`,
    //   );
    // }
    const requestBodyBuffer = await readBody(body, { as: "buffer" });
    return requestBodyBuffer;
  };
  // maybe we could use https://github.com/form-data/form-data
  // for now we'll just return { fields, files } it's good enough to work with
  const formData = async () => {
    const contentType = headers["content-type"];
    if (contentType !== "multipart/form-data") {
      console.warn(
        `formData() called on a request with content-type: "${contentType}". multipart/form-data was expected.`,
      );
    }
    const { formidable } = await import("formidable");
    const form = formidable({});
    nodeRequest.resume(); // was paused in start_server.js
    const [fields, files] = await form.parse(nodeRequest);
    const requestBodyFormData = { fields, files };
    return requestBodyFormData;
  };

  const text = async () => {
    const contentType = headers["content-type"];
    if (!CONTENT_TYPE.isTextual(contentType)) {
      console.warn(
        `text() called on a request with content-type "${contentType}". A textual content-type was expected.`,
      );
    }
    const requestBodyString = await readBody(body, { as: "string" });
    return requestBodyString;
  };
  const json = async () => {
    const contentType = headers["content-type"];
    if (!CONTENT_TYPE.isJson(contentType)) {
      console.warn(
        `json() called on a request with content-type "${contentType}". A json content-type was expected.`,
      );
    }
    const requestBodyString = await readBody(body, { as: "string" });
    const requestBodyJSON = JSON.parse(requestBodyString);
    return requestBodyJSON;
  };
  const queryString = async () => {
    const contentType = headers["content-type"];
    if (contentType !== "application/x-www-form-urlencoded") {
      console.warn(
        `queryString() called on a request with content-type "${contentType}". application/x-www-form-urlencoded was expected.`,
      );
    }
    const requestBodyString = await readBody(body, { as: "string" });
    const requestBodyQueryStringParsed = parse(requestBodyString);
    return requestBodyQueryStringParsed;
  };

  const forwarded = headers["forwarded"];
  let ip;
  let host;
  if (forwarded) {
    const forwardedParsed = parseSingleHeaderWithAttributes(forwarded);
    ip = forwardedParsed.for;
    host = forwardedParsed.host;
  } else {
    const forwardedFor = headers["x-forwarded-for"];
    const forwardedHost = headers["x-forwarded-host"];
    if (forwardedFor) {
      // format is <client-ip>, <proxy1>, <proxy2>
      ip = forwardedFor.split(",")[0];
    } else {
      ip = nodeRequest.socket.remoteAddress;
    }
    if (forwardedHost) {
      host = forwardedHost;
    } else {
      host = headers["host"];
    }
  }

  return Object.freeze({
    ip,
    host,
    signal: handleRequestOperation.signal,
    http2: Boolean(nodeRequest.stream),
    origin: requestOrigin,
    ...getPropertiesFromResource({
      resource: nodeRequest.url,
      baseUrl: requestOrigin,
    }),
    method: nodeRequest.method,
    headers,
    body,
    buffer,
    formData,
    text,
    json,
    queryString,
  });
};

const readBody = (body, { as }) => {
  return new Promise((resolve, reject) => {
    const bufferArray = [];
    body.subscribe({
      error: reject,
      next: (buffer) => {
        bufferArray.push(buffer);
      },
      complete: () => {
        const bodyAsBuffer = Buffer.concat(bufferArray);
        if (as === "buffer") {
          resolve(bodyAsBuffer);
          return;
        }
        if (as === "string") {
          const bodyAsString = bodyAsBuffer.toString();
          resolve(bodyAsString);
          return;
        }
        if (as === "json") {
          const bodyAsString = bodyAsBuffer.toString();
          const bodyAsJSON = JSON.parse(bodyAsString);
          resolve(bodyAsJSON);
          return;
        }
      },
    });
  });
};
// exported for unit tests
export const readRequestBody = (request, { as }) => {
  if (as === "string") {
    return request.text();
  }
  if (as === "buffer") {
    return request.buffer();
  }
  if (as === "json") {
    return request.json();
  }
  throw new Error(`unsupported ${as}`);
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
