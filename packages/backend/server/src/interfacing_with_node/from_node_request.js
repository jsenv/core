import { Abort } from "@jsenv/abort";
import { createDetailedMessage } from "@jsenv/humanize";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";
import { parse } from "node:querystring";
import {
  colorizeResponseStatus,
  statusToType,
} from "../internal/colorizeResponseStatus.js";
import { headersFromObject } from "../internal/headersFromObject.js";
import { parseSingleHeaderWithAttributes } from "../internal/multiple-header.js";
import { observableFromNodeStream } from "./observable_from_node_stream.js";

export const fromNodeRequest = (
  nodeRequest,
  { serverOrigin, signal, requestBodyLifetime, logger, nagle },
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
  // pause the request body stream to let a chance for other parts of the code to subscribe to the stream
  // Without this the request body readable stream
  // might be closed when we'll try to attach "data" and "end" listeners to it
  nodeRequest.pause();
  if (!nagle) {
    nodeRequest.connection.setNoDelay(true);
  }
  const body = observableFromNodeStream(nodeRequest, {
    readableLifetime: requestBodyLifetime,
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
    nodeRequest.resume(); // was paused in line #53
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
      ipForwarded = forwardedFor.split(",")[0];
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
    body,
    buffer,
    formData,
    text,
    json,
    queryString,
  });
};

const createRequestLogger = (nodeRequest, write) => {
  // Handling request is asynchronous, we buffer logs for that request
  // until we know what happens with that request
  // It delays logs until we know of the request will be handled
  // but it's mandatory to make logs readable.

  const logArray = [];
  const childArray = [];
  const add = ({ type, value }) => {
    logArray.push({ type, value });
  };

  const requestLogger = {
    logArray,
    childArray,
    hasPushChild: false,
    forPush: () => {
      const childLogBuffer = createRequestLogger(nodeRequest, write);
      childLogBuffer.isChild = true;
      childArray.push(childLogBuffer);
      requestLogger.hasPushChild = true;
      return childLogBuffer;
    },
    debug: (value) => {
      add({
        type: "debug",
        value,
      });
    },
    info: (value) => {
      add({
        type: "info",
        value,
      });
    },
    warn: (value) => {
      add({
        type: "warn",
        value,
      });
    },
    error: (value) => {
      add({
        type: "error",
        value,
      });
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
      add({
        type: isFaviconNotFound
          ? "debug"
          : {
              information: "info",
              success: "info",
              redirection: "info",
              client_error: "warn",
              server_error: "error",
            }[statusType] || "error",
        value: message,
      });
    },
    ended: false,
    end: () => {
      if (requestLogger.ended) {
        return;
      }
      requestLogger.ended = true;
      if (requestLogger.isChild) {
        // keep buffering until root request write logs for everyone
        return;
      }
      const prefixLines = (string, prefix) => {
        return string.replace(/^(?!\s*$)/gm, prefix);
      };
      const writeLog = (
        { type, value },
        { someLogIsError, someLogIsWarn, depth },
      ) => {
        if (depth > 0) {
          value = prefixLines(value, "  ".repeat(depth));
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
      const writeLogs = (loggerToWrite, depth) => {
        const logArray = loggerToWrite.logArray;
        if (logArray.length === 0) {
          return;
        }
        let someLogIsError = false;
        let someLogIsWarn = false;
        for (const log of loggerToWrite.logArray) {
          if (log.type === "error") {
            someLogIsError = true;
          }
          if (log.type === "warn") {
            someLogIsWarn = true;
          }
        }
        const firstLog = logArray.shift();
        const lastLog = logArray.pop();
        const middleLogs = logArray;
        writeLog(firstLog, {
          someLogIsError,
          someLogIsWarn,
          depth,
        });
        for (const middleLog of middleLogs) {
          writeLog(middleLog, {
            someLogIsError,
            someLogIsWarn,
            depth,
          });
        }
        for (const childLoggerToWrite of loggerToWrite.childArray) {
          writeLogs(childLoggerToWrite, depth + 1);
        }
        if (lastLog) {
          writeLog(lastLog, {
            someLogIsError,
            someLogIsWarn,
            depth: depth + 1,
          });
        }
      };
      writeLogs(requestLogger, 0);
    },
  };

  return requestLogger;
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

export const createPushRequest = (
  request,
  { signal, pathname, method, logger },
) => {
  const pushRequest = Object.freeze({
    ...request,
    logger,
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
