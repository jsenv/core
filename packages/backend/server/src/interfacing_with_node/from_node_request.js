/*
 * Builds the `request` object handed to routes from a node request (http or
 * http2 compat api). It is frozen: a plugin wanting another request returns
 * new properties from "redirectRequest" and gets a copy (see
 * applyRedirectionToRequest). The shape is described in
 * docs/handling_requests.md.
 *
 * The values read from headers (`forwarded`, `cookie`...) come from the
 * network: the parsers must never throw on garbage, a request that cannot
 * be read would otherwise escape the request handler.
 */

import { Abort } from "@jsenv/abort";
import { createDetailedMessage } from "@jsenv/humanize";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";
import { parse } from "node:querystring";
import {
  colorizeResponseStatus,
  statusToType,
} from "../internal/colorize_response_status.js";
import { headersFromObject } from "../internal/headers_from_object.js";
import { parseSingleHeaderWithAttributes } from "../internal/multiple_header.js";
import { observableFromNodeStream } from "./observable_from_node_stream.js";

export const fromNodeRequest = (
  nodeRequest,
  { serverOrigin, signal, logger },
) => {
  const requestLogger = createRequestLogger(nodeRequest, (type, value) => {
    const logFunction = logger[type];
    logFunction(value);
  });
  nodeRequest.on("error", (error) => {
    if (error.message === "aborted") {
      requestLogger.debug(
        createDetailedMessage(`request aborted by client`, {
          "error message": error.message,
        }),
      );
    } else {
      // I'm not sure this can happen but it's here in case
      requestLogger.error(
        createDetailedMessage(`"error" event emitted on request`, {
          "error stack": error.stack,
        }),
      );
    }
  });

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
  const cookies = parseRequestCookieHeader(headers["cookie"]);
  // pause the request body stream to let a chance for other parts of the code to subscribe to the stream
  // Without this the request body readable stream
  // might be closed when we'll try to attach "data" and "end" listeners to it
  nodeRequest.pause();
  const body = observableFromNodeStream(nodeRequest);

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
    nodeRequest.resume(); // paused above, formidable reads the node stream directly
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

  // request.ip          -> request ip as received by the server
  // request.ipForwarded -> ip of the client before proxying, undefined when there is no proxy
  // same applies on request.proto and request.host
  // These forwarded values are what the headers say: any client can send them.
  let ip = nodeRequest.socket.remoteAddress;
  let proto = requestOrigin.startsWith("http:") ? "http" : "https";
  let host = headers["host"];
  const forwarded = headers["forwarded"];
  let hostForwarded;
  let ipForwarded;
  let protoForwarded;
  if (forwarded) {
    const forwardedParsed = parseSingleHeaderWithAttributes(forwarded);
    ipForwarded = forwardedParsed.for;
    protoForwarded = forwardedParsed.proto;
    hostForwarded = forwardedParsed.host;
  } else {
    const forwardedFor = headers["x-forwarded-for"];
    const forwardedProto = headers["x-forwarded-proto"];
    const forwardedHost = headers["x-forwarded-host"];
    if (forwardedFor) {
      // format is <client-ip>, <proxy1>, <proxy2>
      ipForwarded = forwardedFor.split(",")[0].trim();
    }
    if (forwardedProto) {
      protoForwarded = forwardedProto;
    }
    if (forwardedHost) {
      hostForwarded = forwardedHost;
    }
  }

  return Object.freeze({
    logger: requestLogger,
    ip,
    ipForwarded,
    proto,
    protoForwarded,
    host,
    hostForwarded,
    params: {},
    signal: handleRequestOperation.signal,
    http2: Boolean(nodeRequest.stream),
    origin: requestOrigin,
    ...getPropertiesFromResource({
      resource: nodeRequest.url,
      baseUrl: requestOrigin,
    }),
    method: nodeRequest.method,
    headers,
    cookies,
    body,
    buffer,
    formData,
    text,
    json,
    queryString,
  });
};

// Handling a request is asynchronous: its logs are buffered until the
// response headers are sent (or the request is dropped) so that the logs of
// concurrent requests do not interleave.
const createRequestLogger = (nodeRequest, write) => {
  const logArray = [];
  const add = (type, value) => {
    logArray.push({ type, value });
  };

  const requestLogger = {
    debug: (value) => {
      add("debug", value);
    },
    info: (value) => {
      add("info", value);
    },
    warn: (value) => {
      add("warn", value);
    },
    error: (value) => {
      add("error", value);
    },
    onHeadersSent: ({ status, statusText }) => {
      const isFaviconNotFound =
        status === 404 && nodeRequest.url === "/favicon.ico";
      if (isFaviconNotFound) {
        if (process.env.CAPTURING_SIDE_EFFECTS) {
          // we don't care about this 99.999999% of the time, it only pollute logs
          return;
        }
      }
      const statusType = statusToType(status);
      let message = `${colorizeResponseStatus(status)}`;
      if (statusText) {
        message += ` ${statusText}`;
      }
      add(
        isFaviconNotFound
          ? "debug"
          : {
              information: "info",
              success: "info",
              redirection: "info",
              client_error: "warn",
              server_error: "error",
            }[statusType] || "error",
        message,
      );
    },
    ended: false,
    end: () => {
      if (requestLogger.ended) {
        return;
      }
      requestLogger.ended = true;
      if (logArray.length === 0) {
        return;
      }
      let someLogIsError = false;
      let someLogIsWarn = false;
      for (const log of logArray) {
        if (log.type === "error") {
          someLogIsError = true;
        }
        if (log.type === "warn") {
          someLogIsWarn = true;
        }
      }
      // every info log of a request that went wrong is written at the
      // warn/error level, so that it shows up next to what went wrong
      const writeLog = ({ type, value }, { indent }) => {
        if (indent) {
          value = prefixLines(value, "  ");
        }
        if (type === "info") {
          if (someLogIsError) {
            type = "error";
          } else if (someLogIsWarn) {
            type = "warn";
          }
        }
        write(type, value);
      };
      // the last log is the response status, shown under the request line
      const lastLog = logArray.length > 1 ? logArray.pop() : null;
      for (const log of logArray) {
        writeLog(log, { indent: false });
      }
      if (lastLog) {
        writeLog(lastLog, { indent: true });
      }
    },
  };

  return requestLogger;
};

const prefixLines = (string, prefix) => {
  return string.replace(/^(?!\s*$)/gm, prefix);
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

const parseRequestCookieHeader = (cookieHeader) => {
  const map = new Map();
  if (!cookieHeader) {
    return map;
  }
  for (const pair of cookieHeader.split(";")) {
    const eqIndex = pair.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }
    const name = pair.slice(0, eqIndex).trim();
    const value = decodeCookieValue(pair.slice(eqIndex + 1).trim());
    map.set(name, value);
  }
  return map;
};

// a cookie value is not necessarily percent-encoded: a malformed sequence
// keeps the raw value
const decodeCookieValue = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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
