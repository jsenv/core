import { Abort, raceCallbacks, raceProcessTeardownEvents } from "@jsenv/abort";
import { createDetailedMessage, createLogger } from "@jsenv/humanize";
import { memoize } from "@jsenv/utils/src/memoize/memoize.js";
import cluster from "node:cluster";
import http from "node:http";
import net, { createServer, isIP } from "node:net";
import { createReadStream, readFileSync, readdirSync, lstatSync, statSync, readFile } from "node:fs";
import { Readable, Stream, Writable } from "node:stream";
import { ReadableStream } from "node:stream/web";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";
import { parse as parse$1 } from "node:querystring";
import { Http2ServerResponse } from "node:http2";
import { createHeadersPattern } from "@jsenv/router/src/shared/headers_pattern.js";
import { PATTERN } from "@jsenv/router/src/shared/pattern.js";
import { createResourcePattern } from "@jsenv/router/src/shared/resource_pattern.js";
import { performance as performance$1 } from "node:perf_hooks";
import { lookup } from "node:dns";
import { networkInterfaces } from "node:os";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { URL_META } from "@jsenv/url-meta";

if ("observable" in Symbol === false) {
  Symbol.observable = Symbol.for("observable");
}

const createObservable = (producer) => {
  if (typeof producer !== "function") {
    throw new TypeError(`producer must be a function, got ${producer}`);
  }

  const observable = {
    [Symbol.observable]: () => observable,
    subscribe: ({
      next = () => {},
      error = (value) => {
        throw value;
      },
      complete = () => {},
    }) => {
      let cleanup = () => {};
      const subscription = {
        closed: false,
        unsubscribe: () => {
          subscription.closed = true;
          cleanup();
        },
      };

      const producerReturnValue = producer({
        next: (value) => {
          if (subscription.closed) return;
          next(value);
        },
        error: (value) => {
          if (subscription.closed) return;
          error(value);
        },
        complete: () => {
          if (subscription.closed) return;
          complete();
        },
      });
      if (typeof producerReturnValue === "function") {
        cleanup = producerReturnValue;
      }
      return subscription;
    },
  };

  return observable;
};

const isObservable = (value) => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "object" || typeof value === "function") {
    return Symbol.observable in value;
  }

  return false;
};

const observableFromValue = (value) => {
  if (isObservable(value)) {
    return value;
  }

  return createObservable(({ next, complete }) => {
    next(value);
    const timer = setTimeout(() => {
      complete();
    });
    return () => {
      clearTimeout(timer);
    };
  });
};

const createCompositeProducer = ({ cleanup = () => {} } = {}) => {
  const observables = new Set();
  const observers = new Set();

  const addObservable = (observable) => {
    if (observables.has(observable)) {
      return false;
    }

    observables.add(observable);
    observers.forEach((observer) => {
      observer.observe(observable);
    });
    return true;
  };

  const removeObservable = (observable) => {
    if (!observables.has(observable)) {
      return false;
    }

    observables.delete(observable);
    observers.forEach((observer) => {
      observer.unobserve(observable);
    });
    return true;
  };

  const producer = ({
    next = () => {},
    complete = () => {},
    error = () => {},
  }) => {
    let completeCount = 0;

    const checkComplete = () => {
      if (completeCount === observables.size) {
        complete();
      }
    };

    const subscriptions = new Map();
    const observe = (observable) => {
      const subscription = observable.subscribe({
        next: (value) => {
          next(value);
        },
        error: (value) => {
          error(value);
        },
        complete: () => {
          subscriptions.delete(observable);
          completeCount++;
          checkComplete();
        },
      });
      subscriptions.set(observable, subscription);
    };
    const unobserve = (observable) => {
      const subscription = subscriptions.get(observable);
      if (!subscription) {
        return;
      }

      subscription.unsubscribe();
      subscriptions.delete(observable);
      checkComplete();
    };
    const observer = {
      observe,
      unobserve,
    };
    observers.add(observer);
    observables.forEach((observable) => {
      observe(observable);
    });

    return () => {
      observers.delete(observer);
      subscriptions.forEach((subscription) => {
        subscription.unsubscribe();
      });
      subscriptions.clear();
      cleanup();
    };
  };

  producer.addObservable = addObservable;
  producer.removeObservable = removeObservable;

  return producer;
};

// https://github.com/jamestalmage/stream-to-observable/blob/master/index.js

const observableFromNodeStream = (
  nodeStream,
  {
    readableStreamLifetime = 120_000, // 2s
  } = {},
) => {
  const observable = createObservable(({ next, error, complete }) => {
    if (nodeStream.isPaused()) {
      nodeStream.resume();
    } else if (nodeStream.complete) {
      complete();
      return null;
    }
    const cleanup = () => {
      nodeStream.removeListener("data", next);
      nodeStream.removeListener("error", error);
      nodeStream.removeListener("end", complete);
      nodeStream.removeListener("close", cleanup);
      nodeStream.destroy();
    };
    // should we do nodeStream.resume() in case the stream was paused ?
    nodeStream.once("error", error);
    nodeStream.on("data", (data) => {
      next(data);
    });
    nodeStream.once("close", () => {
      cleanup();
    });
    nodeStream.once("end", () => {
      complete();
    });
    return cleanup;
  });

  if (nodeStream instanceof Readable) {
    // safe measure, ensure the readable stream gets
    // used in the next ${readableStreamLifetimeInSeconds} otherwise destroys it
    const timeout = setTimeout(() => {
      process.emitWarning(
        `Readable stream not used after ${
          readableStreamLifetime / 1000
        } seconds. It will be destroyed to release resources`,
        {
          CODE: "READABLE_STREAM_TIMEOUT",
          // url is for http client request
          detail: `path: ${nodeStream.path}, fd: ${nodeStream.fd}, url: ${nodeStream.url}`,
        },
      );
      nodeStream.destroy();
    }, readableStreamLifetime);
    observable.timeout = timeout;
    onceReadableStreamUsedOrClosed(nodeStream, () => {
      clearTimeout(timeout);
    });
  }

  return observable;
};

const onceReadableStreamUsedOrClosed = (readableStream, callback) => {
  const dataOrCloseCallback = () => {
    readableStream.removeListener("data", dataOrCloseCallback);
    readableStream.removeListener("close", dataOrCloseCallback);
    callback();
  };
  readableStream.on("data", dataOrCloseCallback);
  readableStream.once("close", dataOrCloseCallback);
};

// https://nodejs.org/api/webstreams.html#readablestreamgetreaderoptions
// we can read as text using TextDecoder, see https://developer.mozilla.org/fr/docs/Web/API/Fetch_API/Using_Fetch#traiter_un_fichier_texte_ligne_%C3%A0_ligne

const observableFromNodeWebReadableStream = (nodeWebReadableStream) => {
  const observable = createObservable(({ next, error, complete }) => {
    const reader = nodeWebReadableStream.getReader();

    const readNext = async () => {
      try {
        const { done, value } = await reader.read();
        if (done) {
          complete();
          return;
        }
        next(value);
        readNext();
      } catch (e) {
        error(e);
      }
    };
    readNext();
    return () => {
      reader.cancel();
    };
  });

  return observable;
};

const normalizeBodyMethods = (body) => {
  if (isObservable(body)) {
    return {
      asObservable: () => body,
      destroy: () => {},
    };
  }

  if (isFileHandle(body)) {
    return {
      asObservable: () => fileHandleToObservable(body),
      destroy: () => {
        body.close();
      },
    };
  }

  if (isNodeStream(body)) {
    return {
      asObservable: () => observableFromNodeStream(body),
      destroy: () => {
        body.destroy();
      },
    };
  }

  if (body instanceof ReadableStream) {
    return {
      asObservable: () => observableFromNodeWebReadableStream(body),
      destroy: () => {
        body.cancel();
      },
    };
  }

  // https://nodejs.org/api/webstreams.html

  return {
    asObservable: () => observableFromValue(body),
    destroy: () => {},
  };
};

const isFileHandle = (value) => {
  return value && value.constructor && value.constructor.name === "FileHandle";
};

const fileHandleToReadableStream = (fileHandle) => {
  const fileReadableStream =
    typeof fileHandle.createReadStream === "function"
      ? fileHandle.createReadStream()
      : createReadStream(
          "/toto", // is it ok to pass a fake path like this?
          {
            fd: fileHandle.fd,
            emitClose: true,
            // autoClose: true
          },
        );
  // I suppose it's required only when doing fs.createReadStream()
  // and not fileHandle.createReadStream()
  // fileReadableStream.on("end", () => {
  //   fileHandle.close()
  // })
  return fileReadableStream;
};

const fileHandleToObservable = (fileHandle) => {
  return observableFromNodeStream(fileHandleToReadableStream(fileHandle));
};

const isNodeStream = (value) => {
  if (value === undefined) {
    return false;
  }

  if (
    value instanceof Stream ||
    value instanceof Writable ||
    value instanceof Readable
  ) {
    return true;
  }

  return false;
};

// https://github.com/Marak/colors.js/blob/b63ef88e521b42920a9e908848de340b31e68c9d/lib/styles.js#L29

const close = "\x1b[0m";
const red = "\x1b[31m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
// const blue = "\x1b[34m"
const magenta = "\x1b[35m";
const cyan = "\x1b[36m";
// const white = "\x1b[37m"

const websocketSuffixColorized = `${magenta}[websocket]${close}`;

const colorizeResponseStatus = (status) => {
  const statusType = statusToType(status);
  if (statusType === "information") return `${cyan}${status}${close}`;
  if (statusType === "success") return `${green}${status}${close}`;
  if (statusType === "redirection") return `${magenta}${status}${close}`;
  if (statusType === "client_error") return `${yellow}${status}${close}`;
  if (statusType === "server_error") return `${red}${status}${close}`;
  return status;
};

// https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
const statusToType = (status) => {
  if (statusIsInformation(status)) return "information";
  if (statusIsSuccess(status)) return "success";
  if (statusIsRedirection(status)) return "redirection";
  if (statusIsClientError(status)) return "client_error";
  if (statusIsServerError(status)) return "server_error";
  return "unknown";
};

const statusIsInformation = (status) => status >= 100 && status < 200;

const statusIsSuccess = (status) => status >= 200 && status < 300;

const statusIsRedirection = (status) => status >= 300 && status < 400;

const statusIsClientError = (status) => status >= 400 && status < 500;

const statusIsServerError = (status) => status >= 500 && status < 600;

const normalizeHeaderName = (headerName) => {
  headerName = String(headerName);
  if (/[^a-z0-9\-#$%&'*+.^_`|~]/i.test(headerName)) {
    throw new TypeError("Invalid character in header field name");
  }

  return headerName.toLowerCase();
};

const normalizeHeaderValue = (headerValue) => {
  return String(headerValue);
};

/*
https://developer.mozilla.org/en-US/docs/Web/API/Headers
https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
*/


const headersFromObject = (headersObject) => {
  const headers = {};

  Object.keys(headersObject).forEach((headerName) => {
    if (headerName[0] === ":") {
      // exclude http2 headers
      return;
    }
    headers[normalizeHeaderName(headerName)] = normalizeHeaderValue(
      headersObject[headerName],
    );
  });

  return headers;
};

/**

 A multiple header is a header with multiple values like

 "text/plain, application/json;q=0.1"

 Each, means it's a new value (it's optionally followed by a space)

 Each; mean it's a property followed by =
 if "" is a string
 if not it's likely a number
 */

const parseMultipleHeader = (
  multipleHeaderString,
  { validateName = () => true, validateProperty = () => true } = {},
) => {
  const values = multipleHeaderString.split(",");
  const multipleHeader = {};
  values.forEach((value) => {
    const valueTrimmed = value.trim();
    const valueParts = valueTrimmed.split(";");
    const name = valueParts[0];
    const nameValidation = validateName(name);
    if (!nameValidation) {
      return;
    }
    const afterName = valueParts.slice(1);
    const properties = parseHeaderProperties(afterName, { validateProperty });
    multipleHeader[name] = properties;
  });
  return multipleHeader;
};

const parseSingleHeaderWithAttributes = (
  string,
  { validateAttribute = () => true } = {},
) => {
  const props = {};
  const attributes = string.split(";");
  for (const attr of attributes) {
    let [name, value] = attr.split("=");
    name = name.trim();
    value = value.trim();
    if (validateAttribute({ name, value })) {
      props[name] = value;
    }
  }
  return props;
};

const parseHeaderProperties = (headerProperties, { validateProperty }) => {
  const properties = {};
  for (const propertySource of headerProperties) {
    const [propertyName, propertyValueString] = propertySource
      .trim()
      .split("=");
    const propertyValue = parseHeaderPropertyValue(propertyValueString);
    const property = { name: propertyName, value: propertyValue };
    const propertyValidation = validateProperty(property);
    if (!propertyValidation) {
      continue;
    }
    properties[propertyName] = propertyValue;
  }
  return properties;
};

const parseHeaderPropertyValue = (headerPropertyValueString) => {
  const firstChar = headerPropertyValueString[0];
  const lastChar =
    headerPropertyValueString[headerPropertyValueString.length - 1];
  if (firstChar === '"' && lastChar === '"') {
    return headerPropertyValueString.slice(1, -1);
  }
  if (isNaN(headerPropertyValueString)) {
    return headerPropertyValueString;
  }
  return parseFloat(headerPropertyValueString);
};

const stringifyMultipleHeader = (
  multipleHeader,
  { validateName = () => true, validateProperty = () => true } = {},
) => {
  return Object.keys(multipleHeader)
    .filter((name) => {
      const headerProperties = multipleHeader[name];
      if (!headerProperties) {
        return false;
      }
      if (typeof headerProperties !== "object") {
        return false;
      }
      const nameValidation = validateName(name);
      if (!nameValidation) {
        return false;
      }
      return true;
    })
    .map((name) => {
      const headerProperties = multipleHeader[name];
      const headerPropertiesString = stringifyHeaderProperties(
        headerProperties,
        {
          validateProperty,
        },
      );
      if (headerPropertiesString.length) {
        return `${name};${headerPropertiesString}`;
      }
      return name;
    })
    .join(", ");
};

const stringifyHeaderProperties = (headerProperties, { validateProperty }) => {
  const headerPropertiesString = Object.keys(headerProperties)
    .map((name) => {
      const property = {
        name,
        value: headerProperties[name],
      };
      return property;
    })
    .filter((property) => {
      const propertyValidation = validateProperty(property);
      if (!propertyValidation) {
        return false;
      }
      return true;
    })
    .map(stringifyHeaderProperty)
    .join(";");
  return headerPropertiesString;
};

const stringifyHeaderProperty = ({ name, value }) => {
  if (typeof value === "string") {
    return `${name}="${value}"`;
  }
  return `${name}=${value}`;
};

const fromNodeRequest = (
  nodeRequest,
  { serverOrigin, signal, requestBodyLifetime, logger },
) => {
  const requestLogger = createRequestLogger(nodeRequest, (type, value) => {
    logger[type](value);
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
    const requestBodyQueryStringParsed = parse$1(requestBodyString);
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
      const childLogBuffer = requestLogger(nodeRequest, write);
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
      const statusType = statusToType(status);
      let message = `${colorizeResponseStatus(status)} ${statusText}`;
      add({
        type:
          status === 404 && nodeRequest.path === "/favicon.ico"
            ? "debug"
            : {
                information: "info",
                success: "info",
                redirection: "info",
                client_error: "warn",
                server_error: "error",
              }[statusType],
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
        const firstLog = loggerToWrite.logArray.shift();
        const lastLog = loggerToWrite.logArray.pop();
        const middleLogs = loggerToWrite.logArray;
        if (!firstLog) {
          debugger;
        }
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

const applyRedirectionToRequest = (
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

const createPushRequest = (
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

const writeNodeResponse = async (
  responseStream,
  { status, statusText, headers, body, bodyEncoding },
  { signal, ignoreBody, onAbort, onError, onHeadersSent, onEnd } = {},
) => {
  body = await body;
  const bodyMethods = normalizeBodyMethods(body);

  if (signal.aborted) {
    bodyMethods.destroy();
    responseStream.destroy();
    onAbort();
    return;
  }

  writeHead(responseStream, {
    status,
    statusText,
    headers,
    onHeadersSent,
  });

  if (!body) {
    onEnd();
    responseStream.end();
    return;
  }

  if (ignoreBody) {
    onEnd();
    bodyMethods.destroy();
    responseStream.end();
    return;
  }

  if (bodyEncoding) {
    responseStream.setEncoding(bodyEncoding);
  }

  await new Promise((resolve) => {
    const observable = bodyMethods.asObservable();
    const subscription = observable.subscribe({
      next: (data) => {
        try {
          responseStream.write(data);
        } catch (e) {
          // Something inside Node.js sometimes puts stream
          // in a state where .write() throw despites nodeResponse.destroyed
          // being undefined and "close" event not being emitted.
          // I have tested if we are the one calling destroy
          // (I have commented every .destroy() call)
          // but issue still occurs
          // For the record it's "hard" to reproduce but can be by running
          // a lot of tests against a browser in the context of @jsenv/core testing
          if (e.code === "ERR_HTTP2_INVALID_STREAM") {
            return;
          }
          responseStream.emit("error", e);
        }
      },
      error: (value) => {
        responseStream.emit("error", value);
      },
      complete: () => {
        responseStream.end();
      },
    });

    raceCallbacks(
      {
        abort: (cb) => {
          signal.addEventListener("abort", cb);
          return () => {
            signal.removeEventListener("abort", cb);
          };
        },
        error: (cb) => {
          responseStream.on("error", cb);
          return () => {
            responseStream.removeListener("error", cb);
          };
        },
        close: (cb) => {
          responseStream.on("close", cb);
          return () => {
            responseStream.removeListener("close", cb);
          };
        },
        finish: (cb) => {
          responseStream.on("finish", cb);
          return () => {
            responseStream.removeListener("finish", cb);
          };
        },
      },
      (winner) => {
        const raceEffects = {
          abort: () => {
            subscription.unsubscribe();
            responseStream.destroy();
            onAbort();
            resolve();
          },
          error: (error) => {
            subscription.unsubscribe();
            responseStream.destroy();
            onError(error);
            resolve();
          },
          close: () => {
            // close body in case nodeResponse is prematurely closed
            // while body is writing
            // it may happen in case of server sent event
            // where body is kept open to write to client
            // and the browser is reloaded or closed for instance
            subscription.unsubscribe();
            responseStream.destroy();
            onAbort();
            resolve();
          },
          finish: () => {
            onEnd();
            resolve();
          },
        };
        raceEffects[winner.name](winner.data);
      },
    );
  });
};

const writeHead = (
  responseStream,
  { status, statusText, headers, onHeadersSent },
) => {
  const responseIsHttp2ServerResponse =
    responseStream instanceof Http2ServerResponse;
  const responseIsServerHttp2Stream =
    responseStream.constructor.name === "ServerHttp2Stream";
  let nodeHeaders = headersToNodeHeaders(headers, {
    // https://github.com/nodejs/node/blob/79296dc2d02c0b9872bbfcbb89148ea036a546d0/lib/internal/http2/compat.js#L112
    ignoreConnectionHeader:
      responseIsHttp2ServerResponse || responseIsServerHttp2Stream,
  });
  if (statusText === undefined) {
    statusText = statusTextFromStatus$1(status);
  } else {
    statusText = statusText.replace(/\n/g, "");
  }
  if (responseIsServerHttp2Stream) {
    nodeHeaders = {
      ...nodeHeaders,
      ":status": status,
    };
    responseStream.respond(nodeHeaders);
    onHeadersSent({ nodeHeaders, status, statusText });
    return;
  }
  // nodejs strange signature for writeHead force this
  // https://nodejs.org/api/http.html#http_response_writehead_statuscode_statusmessage_headers
  if (
    // https://github.com/nodejs/node/blob/79296dc2d02c0b9872bbfcbb89148ea036a546d0/lib/internal/http2/compat.js#L97
    responseIsHttp2ServerResponse
  ) {
    responseStream.writeHead(status, nodeHeaders);
    onHeadersSent({ nodeHeaders, status, statusText });
    return;
  }

  try {
    responseStream.writeHead(status, statusText, nodeHeaders);
  } catch (e) {
    if (
      e.code === "ERR_INVALID_CHAR" &&
      e.message.includes("Invalid character in statusMessage")
    ) {
      throw new Error(`Invalid character in statusMessage
--- status message ---
${statusText}`);
    }
    throw e;
  }
  onHeadersSent({ nodeHeaders, status, statusText });
};

const statusTextFromStatus$1 = (status) =>
  http.STATUS_CODES[status] || "not specified";

const headersToNodeHeaders = (headers, { ignoreConnectionHeader }) => {
  const nodeHeaders = {};

  Object.keys(headers).forEach((name) => {
    if (name === "connection" && ignoreConnectionHeader) return;
    const nodeHeaderName = name in mapping ? mapping[name] : name;
    nodeHeaders[nodeHeaderName] = headers[name];
  });

  return nodeHeaders;
};

const mapping = {
  // "content-type": "Content-Type",
  // "last-modified": "Last-Modified",
};

const composeTwoObjects = (
  firstObject,
  secondObject,
  { keysComposition, strict = false, forceLowerCase = false } = {},
) => {
  if (forceLowerCase) {
    return applyCompositionForcingLowerCase(firstObject, secondObject, {
      keysComposition,
      strict,
    });
  }

  return applyCaseSensitiveComposition(firstObject, secondObject, {
    keysComposition,
    strict,
  });
};

const applyCaseSensitiveComposition = (
  firstObject,
  secondObject,
  { keysComposition, strict },
) => {
  if (strict) {
    const composed = {};
    Object.keys(keysComposition).forEach((key) => {
      composed[key] = composeValueAtKey({
        firstObject,
        secondObject,
        keysComposition,
        key,
        firstKey: keyExistsIn(key, firstObject) ? key : null,
        secondKey: keyExistsIn(key, secondObject) ? key : null,
      });
    });
    return composed;
  }

  const composed = {};
  Object.keys(firstObject).forEach((key) => {
    composed[key] = firstObject[key];
  });
  Object.keys(secondObject).forEach((key) => {
    composed[key] = composeValueAtKey({
      firstObject,
      secondObject,
      keysComposition,
      key,
      firstKey: keyExistsIn(key, firstObject) ? key : null,
      secondKey: keyExistsIn(key, secondObject) ? key : null,
    });
  });
  return composed;
};

const applyCompositionForcingLowerCase = (
  firstObject,
  secondObject,
  { keysComposition, strict },
) => {
  if (strict) {
    const firstObjectKeyMapping = {};
    Object.keys(firstObject).forEach((key) => {
      firstObjectKeyMapping[key.toLowerCase()] = key;
    });
    const secondObjectKeyMapping = {};
    Object.keys(secondObject).forEach((key) => {
      secondObjectKeyMapping[key.toLowerCase()] = key;
    });
    Object.keys(keysComposition).forEach((key) => {
      composed[key] = composeValueAtKey({
        firstObject,
        secondObject,
        keysComposition,
        key,
        firstKey: firstObjectKeyMapping[key] || null,
        secondKey: secondObjectKeyMapping[key] || null,
      });
    });
  }

  const composed = {};
  Object.keys(firstObject).forEach((key) => {
    composed[key.toLowerCase()] = firstObject[key];
  });
  Object.keys(secondObject).forEach((key) => {
    const keyLowercased = key.toLowerCase();

    composed[key.toLowerCase()] = composeValueAtKey({
      firstObject,
      secondObject,
      keysComposition,
      key: keyLowercased,
      firstKey: keyExistsIn(keyLowercased, firstObject)
        ? keyLowercased
        : keyExistsIn(key, firstObject)
          ? key
          : null,
      secondKey: keyExistsIn(keyLowercased, secondObject)
        ? keyLowercased
        : keyExistsIn(key, secondObject)
          ? key
          : null,
    });
  });
  return composed;
};

const composeValueAtKey = ({
  firstObject,
  secondObject,
  firstKey,
  secondKey,
  key,
  keysComposition,
}) => {
  if (!firstKey) {
    return secondObject[secondKey];
  }

  if (!secondKey) {
    return firstObject[firstKey];
  }

  const keyForCustomComposition = keyExistsIn(key, keysComposition)
    ? key
    : null;
  if (!keyForCustomComposition) {
    return secondObject[secondKey];
  }

  const composeTwoValues = keysComposition[keyForCustomComposition];
  return composeTwoValues(firstObject[firstKey], secondObject[secondKey]);
};

const keyExistsIn = (key, object) => {
  return Object.prototype.hasOwnProperty.call(object, key);
};

const composeTwoHeaders = (firstHeaders, secondHeaders) => {
  return composeTwoObjects(firstHeaders, secondHeaders, {
    keysComposition: HEADER_NAMES_COMPOSITION,
    forceLowerCase: true,
  });
};

const composeHeaderValues = (value, nextValue) => {
  const currentValues = value
    .split(", ")
    .map((part) => part.trim().toLowercase());
  const nextValues = nextValue
    .split(", ")
    .map((part) => part.trim().toLowercase());
  for (const nextValue of nextValues) {
    if (!currentValues.includes(nextValue)) {
      currentValues.push(nextValue);
    }
  }
  return currentValues.join(", ");
};

const HEADER_NAMES_COMPOSITION = {
  "accept": composeHeaderValues,
  "accept-charset": composeHeaderValues,
  "accept-language": composeHeaderValues,
  "access-control-allow-headers": composeHeaderValues,
  "access-control-allow-methods": composeHeaderValues,
  "access-control-allow-origin": composeHeaderValues,
  "accept-patch": composeHeaderValues,
  "accept-post": composeHeaderValues,
  "allow": composeHeaderValues,
  // https://www.w3.org/TR/server-timing/
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server-Timing
  "server-timing": composeHeaderValues,
  // 'content-type', // https://github.com/ninenines/cowboy/issues/1230
  "vary": composeHeaderValues,
};

const listen = async ({
  signal = new AbortController().signal,
  server,
  port,
  portHint,
  hostname,
}) => {
  const listeningOperation = Abort.startOperation();

  try {
    listeningOperation.addAbortSignal(signal);

    if (portHint) {
      listeningOperation.throwIfAborted();
      port = await findFreePort(portHint, {
        signal: listeningOperation.signal,
        hostname,
      });
    }
    listeningOperation.throwIfAborted();
    port = await startListening({ server, port, hostname });
    listeningOperation.addAbortCallback(() => stopListening(server));
    listeningOperation.throwIfAborted();

    return port;
  } finally {
    await listeningOperation.end();
  }
};

const findFreePort = async (
  initialPort = 1,
  {
    signal = new AbortController().signal,
    hostname = "127.0.0.1",
    min = 1,
    max = 65534,
    next = (port) => port + 1,
  } = {},
) => {
  const findFreePortOperation = Abort.startOperation();
  try {
    findFreePortOperation.addAbortSignal(signal);
    findFreePortOperation.throwIfAborted();

    const testUntil = async (port, host) => {
      findFreePortOperation.throwIfAborted();
      const free = await portIsFree(port, host);
      if (free) {
        return port;
      }

      const nextPort = next(port);
      if (nextPort > max) {
        throw new Error(
          `${hostname} has no available port between ${min} and ${max}`,
        );
      }
      return testUntil(nextPort, hostname);
    };
    const freePort = await testUntil(initialPort, hostname);
    return freePort;
  } finally {
    await findFreePortOperation.end();
  }
};

const portIsFree = async (port, hostname) => {
  const server = createServer();

  try {
    await startListening({
      server,
      port,
      hostname,
    });
  } catch (error) {
    if (error && error.code === "EADDRINUSE") {
      return false;
    }
    if (error && error.code === "EACCES") {
      return false;
    }
    throw error;
  }

  await stopListening(server);
  return true;
};

const startListening = ({ server, port, hostname }) => {
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.on("listening", () => {
      // in case port is 0 (randomly assign an available port)
      // https://nodejs.org/api/net.html#net_server_listen_port_host_backlog_callback
      resolve(server.address().port);
    });
    server.listen(port, hostname);
  });
};

const stopListening = (server) => {
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.on("close", resolve);
    server.close();
  });
};

const listenEvent = (
  objectWithEventEmitter,
  eventName,
  callback,
  { once = false } = {},
) => {
  if (once) {
    objectWithEventEmitter.once(eventName, callback);
  } else {
    objectWithEventEmitter.addListener(eventName, callback);
  }
  return () => {
    objectWithEventEmitter.removeListener(eventName, callback);
  };
};

const listenRequest = (nodeServer, requestCallback) => {
  if (nodeServer._httpServer) {
    const removeHttpRequestListener = listenEvent(
      nodeServer._httpServer,
      "request",
      requestCallback,
    );
    const removeTlsRequestListener = listenEvent(
      nodeServer._tlsServer,
      "request",
      requestCallback,
    );
    return () => {
      removeHttpRequestListener();
      removeTlsRequestListener();
    };
  }
  return listenEvent(nodeServer, "request", requestCallback);
};

const listenServerConnectionError = (
  nodeServer,
  connectionErrorCallback,
  { ignoreErrorAfterConnectionIsDestroyed = true } = {},
) => {
  const cleanupSet = new Set();

  const removeConnectionListener = listenEvent(
    nodeServer,
    "connection",
    (socket) => {
      const removeSocketErrorListener = listenEvent(
        socket,
        "error",
        (error) => {
          if (ignoreErrorAfterConnectionIsDestroyed && socket.destroyed) {
            return;
          }
          connectionErrorCallback(error, socket);
        },
      );
      const removeOnceSocketCloseListener = listenEvent(
        socket,
        "close",
        () => {
          removeSocketErrorListener();
          cleanupSet.delete(cleanup);
        },
        {
          once: true,
        },
      );
      const cleanup = () => {
        removeSocketErrorListener();
        removeOnceSocketCloseListener();
      };
      cleanupSet.add(cleanup);
    },
  );
  return () => {
    removeConnectionListener();
    cleanupSet.forEach((cleanup) => {
      cleanup();
    });
    cleanupSet.clear();
  };
};

const composeTwoResponses = (firstResponse, secondResponse) => {
  return composeTwoObjects(firstResponse, secondResponse, {
    keysComposition: RESPONSE_KEYS_COMPOSITION,
    strict: true,
  });
};

const RESPONSE_KEYS_COMPOSITION = {
  status: (prevStatus, status) => status,
  statusText: (prevStatusText, statusText) => statusText,
  statusMessage: (prevStatusMessage, statusMessage) => statusMessage,
  headers: composeTwoHeaders,
  body: (prevBody, body) => body,
  bodyEncoding: (prevEncoding, encoding) => encoding,
  timing: (prevTiming, timing) => {
    return { ...prevTiming, ...timing };
  },
};

/**

https://stackoverflow.com/a/42019773/2634179

*/


const createPolyglotServer = async ({
  http2 = false,
  http1Allowed = true,
  certificate,
  privateKey,
}) => {
  const httpServer = http.createServer();
  const tlsServer = await createSecureServer({
    certificate,
    privateKey,
    http2,
    http1Allowed,
  });
  const netServer = net.createServer({
    allowHalfOpen: false,
  });

  listenEvent(netServer, "connection", (socket) => {
    detectSocketProtocol(socket, (protocol) => {
      if (protocol === "http") {
        httpServer.emit("connection", socket);
        return;
      }

      if (protocol === "tls") {
        tlsServer.emit("connection", socket);
        return;
      }

      const response = [
        `HTTP/1.1 400 Bad Request`,
        `Content-Length: 0`,
        "",
        "",
      ].join("\r\n");
      socket.write(response);
      socket.end();
      socket.destroy();
      netServer.emit(
        "clientError",
        new Error("protocol error, Neither http, nor tls"),
        socket,
      );
    });
  });

  netServer._httpServer = httpServer;
  netServer._tlsServer = tlsServer;

  return netServer;
};

// The async part is just to lazyly import "http2" or "https"
// so that these module are parsed only if used.
// https://nodejs.org/api/tls.html#tlscreatesecurecontextoptions
const createSecureServer = async ({
  certificate,
  privateKey,
  http2,
  http1Allowed,
}) => {
  if (http2) {
    const { createSecureServer } = await import("node:http2");
    return createSecureServer({
      cert: certificate,
      key: privateKey,
      allowHTTP1: http1Allowed,
    });
  }

  const { createServer } = await import("node:https");
  return createServer({
    cert: certificate,
    key: privateKey,
  });
};

const detectSocketProtocol = (socket, protocolDetectedCallback) => {
  let removeOnceReadableListener = () => {};

  const tryToRead = () => {
    const buffer = socket.read(1);
    if (buffer === null) {
      removeOnceReadableListener = socket.once("readable", tryToRead);
      return;
    }

    const firstByte = buffer[0];
    socket.unshift(buffer);
    if (firstByte === 22) {
      protocolDetectedCallback("tls");
      return;
    }
    if (firstByte > 32 && firstByte < 127) {
      protocolDetectedCallback("http");
      return;
    }
    protocolDetectedCallback(null);
  };

  tryToRead();

  return () => {
    removeOnceReadableListener();
  };
};

const trackServerPendingConnections = (nodeServer, { http2 }) => {
  if (http2) {
    // see http2.js: we rely on https://nodejs.org/api/http2.html#http2_compatibility_api
    return trackHttp1ServerPendingConnections(nodeServer);
  }
  return trackHttp1ServerPendingConnections(nodeServer);
};

// const trackHttp2ServerPendingSessions = () => {}

const trackHttp1ServerPendingConnections = (nodeServer) => {
  const pendingConnections = new Set();

  const removeConnectionListener = listenEvent(
    nodeServer,
    "connection",
    (connection) => {
      pendingConnections.add(connection);
      listenEvent(
        connection,
        "close",
        () => {
          pendingConnections.delete(connection);
        },
        { once: true },
      );
    },
  );

  const stop = async (reason) => {
    removeConnectionListener();
    const pendingConnectionsArray = Array.from(pendingConnections);
    pendingConnections.clear();

    await Promise.all(
      pendingConnectionsArray.map(async (pendingConnection) => {
        await destroyConnection(pendingConnection, reason);
      }),
    );
  };

  return { stop };
};

const destroyConnection = (connection, reason) => {
  return new Promise((resolve, reject) => {
    connection.destroy(reason, (error) => {
      if (error) {
        if (error === reason || error.code === "ENOTCONN") {
          resolve();
        } else {
          reject(error);
        }
      } else {
        resolve();
      }
    });
  });
};

// export const trackServerPendingStreams = (nodeServer) => {
//   const pendingClients = new Set()

//   const streamListener = (http2Stream, headers, flags) => {
//     const client = { http2Stream, headers, flags }

//     pendingClients.add(client)
//     http2Stream.on("close", () => {
//       pendingClients.delete(client)
//     })
//   }

//   nodeServer.on("stream", streamListener)

//   const stop = ({
//     status,
//     // reason
//   }) => {
//     nodeServer.removeListener("stream", streamListener)

//     return Promise.all(
//       Array.from(pendingClients).map(({ http2Stream }) => {
//         if (http2Stream.sentHeaders === false) {
//           http2Stream.respond({ ":status": status }, { endStream: true })
//         }

//         return new Promise((resolve, reject) => {
//           if (http2Stream.closed) {
//             resolve()
//           } else {
//             http2Stream.close(NGHTTP2_NO_ERROR, (error) => {
//               if (error) {
//                 reject(error)
//               } else {
//                 resolve()
//               }
//             })
//           }
//         })
//       }),
//     )
//   }

//   return { stop }
// }

// export const trackServerPendingSessions = (nodeServer, { onSessionError }) => {
//   const pendingSessions = new Set()

//   const sessionListener = (session) => {
//     session.on("close", () => {
//       pendingSessions.delete(session)
//     })
//     session.on("error", onSessionError)
//     pendingSessions.add(session)
//   }

//   nodeServer.on("session", sessionListener)

//   const stop = async (reason) => {
//     nodeServer.removeListener("session", sessionListener)

//     await Promise.all(
//       Array.from(pendingSessions).map((pendingSession) => {
//         return new Promise((resolve, reject) => {
//           pendingSession.close((error) => {
//             if (error) {
//               if (error === reason || error.code === "ENOTCONN") {
//                 resolve()
//               } else {
//                 reject(error)
//               }
//             } else {
//               resolve()
//             }
//           })
//         })
//       }),
//     )
//   }

//   return { stop }
// }

const trackServerPendingRequests = (nodeServer, { http2 }) => {
  if (http2) {
    // see http2.js: we rely on https://nodejs.org/api/http2.html#http2_compatibility_api
    return trackHttp1ServerPendingRequests(nodeServer);
  }
  return trackHttp1ServerPendingRequests(nodeServer);
};

const trackHttp1ServerPendingRequests = (nodeServer) => {
  const pendingClients = new Set();

  const removeRequestListener = listenRequest(
    nodeServer,
    (nodeRequest, nodeResponse) => {
      const client = { nodeRequest, nodeResponse };
      pendingClients.add(client);
      nodeResponse.once("close", () => {
        pendingClients.delete(client);
      });
    },
  );

  const stop = async ({ status, reason }) => {
    removeRequestListener();
    const pendingClientsArray = Array.from(pendingClients);
    pendingClients.clear();
    await Promise.all(
      pendingClientsArray.map(({ nodeResponse }) => {
        if (nodeResponse.headersSent === false) {
          nodeResponse.writeHead(status, String(reason));
        }

        // http2
        if (nodeResponse.close) {
          return new Promise((resolve, reject) => {
            if (nodeResponse.closed) {
              resolve();
            } else {
              nodeResponse.close((error) => {
                if (error) {
                  reject(error);
                } else {
                  resolve();
                }
              });
            }
          });
        }

        // http
        return new Promise((resolve) => {
          if (nodeResponse.destroyed) {
            resolve();
          } else {
            nodeResponse.once("close", () => {
              resolve();
            });
            nodeResponse.destroy();
          }
        });
      }),
    );
  };

  return { stop };
};

const routeInspectorHtmlFileUrl = import.meta.resolve(
  "./html/route_inspector.html",
);

const jsenvServiceRouting = (router) => {
  router.add({
    endpoint: "GET /__inspect__/routes",
    availableContentTypes: ["text/html"],
    response: () => {
      const inspectorHtml = readFileSync(
        new URL(routeInspectorHtmlFileUrl),
        "utf8",
      );
      return new Response(inspectorHtml, {
        headers: { "content-type": "html" },
      });
    },
  });
  router.add({
    endpoint: "GET /__inspect__/routes",
    availableContentTypes: ["application/json"],
    response: () => {
      const routeJSON = router.inspect();
      return Response.json(routeJSON);
    },
  });
  const headersToInjectMap = new Map();

  return {
    name: "jsenv:routing",
    handleRequest: async (request, { websocket }) => {
      const response = await router.match(request, {
        websocket,
        injectResponseHeader: (name, value) => {
          const headers = headersToInjectMap.get(request);
          if (headers) {
            headers[name] = value;
          } else {
            headersToInjectMap.set(request, { [name]: value });
          }
        },
      });
      request.signal.addEventListener("abort", () => {
        headersToInjectMap.delete(request);
      });
      return response;
    },
    injectResponseHeaders: (response, { request }) => {
      const headers = headersToInjectMap.get(request);
      headersToInjectMap.delete(request);
      return headers;
    },
  };
};

const pickAcceptedContent = ({
  availables,
  accepteds,
  getAcceptanceScore,
}) => {
  let highestScore = -1;
  let availableWithHighestScore = null;
  let availableIndex = 0;
  while (availableIndex < availables.length) {
    const available = availables[availableIndex];
    availableIndex++;

    let acceptedIndex = 0;
    while (acceptedIndex < accepteds.length) {
      const accepted = accepteds[acceptedIndex];
      acceptedIndex++;

      const score = getAcceptanceScore(accepted, available);
      if (score > highestScore) {
        availableWithHighestScore = available;
        highestScore = score;
      }
    }
  }
  return availableWithHighestScore;
};

const pickContentEncoding = (request, availableEncodings) => {
  const { headers = {} } = request;
  const requestAcceptEncodingHeader = headers["accept-encoding"];
  if (!requestAcceptEncodingHeader) {
    return null;
  }

  const encodingsAccepted = parseAcceptEncodingHeader(
    requestAcceptEncodingHeader,
  );
  return pickAcceptedContent({
    accepteds: encodingsAccepted,
    availables: availableEncodings,
    getAcceptanceScore: getEncodingAcceptanceScore,
  });
};

const parseAcceptEncodingHeader = (acceptEncodingHeaderString) => {
  const acceptEncodingHeader = parseMultipleHeader(acceptEncodingHeaderString, {
    validateProperty: ({ name }) => {
      // read only q, anything else is ignored
      return name === "q";
    },
  });

  const encodingsAccepted = [];
  Object.keys(acceptEncodingHeader).forEach((key) => {
    const { q = 1 } = acceptEncodingHeader[key];
    const value = key;
    encodingsAccepted.push({
      value,
      quality: q,
    });
  });
  encodingsAccepted.sort((a, b) => {
    return b.quality - a.quality;
  });
  return encodingsAccepted;
};

const getEncodingAcceptanceScore = ({ value, quality }, availableEncoding) => {
  if (value === "*") {
    return quality;
  }

  // normalize br to brotli
  if (value === "br") value = "brotli";
  if (availableEncoding === "br") availableEncoding = "brotli";

  if (value === availableEncoding) {
    return quality;
  }

  return -1;
};

const pickContentLanguage = (request, availableLanguages) => {
  const { headers = {} } = request;
  const requestAcceptLanguageHeader = headers["accept-language"];
  if (!requestAcceptLanguageHeader) {
    return null;
  }

  const languagesAccepted = parseAcceptLanguageHeader(
    requestAcceptLanguageHeader,
  );
  return pickAcceptedContent({
    accepteds: languagesAccepted,
    availables: availableLanguages,
    getAcceptanceScore: getLanguageAcceptanceScore,
  });
};

const parseAcceptLanguageHeader = (acceptLanguageHeaderString) => {
  const acceptLanguageHeader = parseMultipleHeader(acceptLanguageHeaderString, {
    validateProperty: ({ name }) => {
      // read only q, anything else is ignored
      return name === "q";
    },
  });

  const languagesAccepted = [];
  Object.keys(acceptLanguageHeader).forEach((key) => {
    const { q = 1 } = acceptLanguageHeader[key];
    const value = key;
    languagesAccepted.push({
      value,
      quality: q,
    });
  });
  languagesAccepted.sort((a, b) => {
    return b.quality - a.quality;
  });
  return languagesAccepted;
};

const getLanguageAcceptanceScore = ({ value, quality }, availableLanguage) => {
  const [acceptedPrimary, acceptedVariant] = decomposeLanguage(value);
  const [availablePrimary, availableVariant] =
    decomposeLanguage(availableLanguage);

  const primaryAccepted =
    acceptedPrimary === "*" ||
    acceptedPrimary.toLowerCase() === availablePrimary.toLowerCase();
  const variantAccepted =
    acceptedVariant === "*" ||
    compareVariant(acceptedVariant, availableVariant);

  if (primaryAccepted && variantAccepted) {
    return quality + 1;
  }
  if (primaryAccepted) {
    return quality;
  }
  return -1;
};

const decomposeLanguage = (fullType) => {
  const [primary, variant] = fullType.split("-");
  return [primary, variant];
};

const compareVariant = (left, right) => {
  if (left === right) {
    return true;
  }
  if (left && right && left.toLowerCase() === right.toLowerCase()) {
    return true;
  }
  return false;
};

const pickContentType = (request, availableContentTypes) => {
  const { headers = {} } = request;
  const requestAcceptHeader = headers.accept;
  if (!requestAcceptHeader) {
    return null;
  }

  const contentTypesAccepted = parseAcceptHeader(requestAcceptHeader);
  return pickAcceptedContent({
    accepteds: contentTypesAccepted,
    availables: availableContentTypes,
    getAcceptanceScore: getContentTypeAcceptanceScore,
  });
};

const parseAcceptHeader = (acceptHeader) => {
  const acceptHeaderObject = parseMultipleHeader(acceptHeader, {
    validateProperty: ({ name }) => {
      // read only q, anything else is ignored
      return name === "q";
    },
  });

  const accepts = [];
  Object.keys(acceptHeaderObject).forEach((key) => {
    const { q = 1 } = acceptHeaderObject[key];
    const value = key;
    accepts.push({
      value,
      quality: q,
    });
  });
  accepts.sort((a, b) => {
    return b.quality - a.quality;
  });
  return accepts;
};

const getContentTypeAcceptanceScore = (
  { value, quality },
  availableContentType,
) => {
  const [acceptedType, acceptedSubtype] = decomposeContentType(value);
  const [availableType, availableSubtype] =
    decomposeContentType(availableContentType);

  const typeAccepted = acceptedType === "*" || acceptedType === availableType;
  const subtypeAccepted =
    acceptedSubtype === "*" || acceptedSubtype === availableSubtype;

  if (typeAccepted && subtypeAccepted) {
    return quality;
  }
  return -1;
};

const decomposeContentType = (fullType) => {
  const [type, subtype] = fullType.split("/");
  return [type, subtype];
};

const replacePlaceholdersInHtml = (html, replacers) => {
  return html.replace(/\$\{(\w+)\}/g, (match, name) => {
    const replacer = replacers[name];
    if (replacer === undefined) {
      return match;
    }
    if (typeof replacer === "function") {
      return replacer();
    }
    return replacer;
  });
};

const clientErrorHtmlTemplateFileUrl = import.meta.resolve("./html/4xx.html");
const endpointInspectorUrl = `/__inspect__/routes`;

const HTTP_METHODS = [
  "OPTIONS",
  "HEAD",
  "GET",
  "POST",
  "PATCH",
  "PUT",
  "DELETE",
];

const createRouter = () => {
  const routeSet = new Set();

  const constructAvailableEndpoints = () => {
    // TODO: memoize
    // TODO: construct only if the route is visible to that client
    const availableEndpoints = [];
    const createEndpoint = ({ method, resource }) => {
      return {
        method,
        resource,
        toString: () => {
          return `${method} ${resource}`;
        },
      };
    };

    for (const route of routeSet) {
      const endpointResource = route.resourcePattern.generateExample();
      if (route.method === "*") {
        for (const HTTP_METHOD of HTTP_METHODS) {
          availableEndpoints.push(
            createEndpoint({
              method: HTTP_METHOD,
              resource: endpointResource,
            }),
          );
        }
      } else {
        availableEndpoints.push(
          createEndpoint({
            method: route.method,
            resource: endpointResource,
          }),
        );
      }
    }
    return availableEndpoints;
  };

  const createResourceOptions = () => {
    const acceptedContentTypeSet = new Set();
    const postAcceptedContentTypeSet = new Set();
    const patchAcceptedContentTypeSet = new Set();
    const allowedMethodSet = new Set();
    return {
      onMethodAllowed: (route, method) => {
        allowedMethodSet.add(method);
        for (const acceptedContentType of route.acceptedContentTypes) {
          acceptedContentTypeSet.add(acceptedContentType);
          if (method === "POST") {
            postAcceptedContentTypeSet.add(acceptedContentType);
          }
          if (method === "PATCH") {
            patchAcceptedContentTypeSet.add(acceptedContentType);
          }
        }
      },
      asResponseHeaders: () => {
        const headers = {};
        if (acceptedContentTypeSet.size) {
          headers["accept"] = Array.from(acceptedContentTypeSet).join(", ");
        }
        if (postAcceptedContentTypeSet.size) {
          headers["accept-post"] = Array.from(postAcceptedContentTypeSet).join(
            ", ",
          );
        }
        if (patchAcceptedContentTypeSet.size) {
          headers["accept-patch"] = Array.from(
            patchAcceptedContentTypeSet,
          ).join(", ");
        }
        if (allowedMethodSet.size) {
          headers["allow"] = Array.from(allowedMethodSet).join(", ");
        }
        return headers;
      },
      toJSON: () => {
        return {
          acceptedContentTypes: Array.from(acceptedContentTypeSet),
          postAcceptedContentTypes: Array.from(postAcceptedContentTypeSet),
          patchAcceptedContentTypes: Array.from(patchAcceptedContentTypeSet),
          allowedMethods: Array.from(allowedMethodSet),
        };
      },
    };
  };
  const forEachMethodAllowed = (route, onMethodAllowed) => {
    const supportedMethods =
      route.method === "*" ? HTTP_METHODS : [route.method];
    for (const supportedMethod of supportedMethods) {
      onMethodAllowed(supportedMethod);
    }
  };
  const inferResourceOPTIONS = (request) => {
    const resourceOptions = createResourceOptions();
    for (const route of routeSet) {
      if (!route.matchResource(request.resource)) {
        continue;
      }
      forEachMethodAllowed(route, (methodAllowed) => {
        resourceOptions.onMethodAllowed(route, methodAllowed);
      });
    }
    return resourceOptions;
  };
  const inferServerOPTIONS = () => {
    const serverOptions = createResourceOptions();
    const resourceOptionsMap = new Map();

    for (const route of routeSet) {
      const routeResource = route.resource;
      let resourceOptions = resourceOptionsMap.get(routeResource);
      if (!resourceOptions) {
        resourceOptions = createResourceOptions();
        resourceOptionsMap.set(routeResource, resourceOptions);
      }
      forEachMethodAllowed(route, (method) => {
        serverOptions.onMethodAllowed(route, method);
        resourceOptions.onMethodAllowed(route, method);
      });
    }
    return {
      server: serverOptions,
      resourceOptionsMap,
    };
  };

  const router = {
    hasSomeWebsocketRoute: false,
  };

  /**
   * Adds a route to the router.
   *
   * @param {Object} params - Route configuration object
   * @param {string} params.endpoint - String in format "METHOD /resource/path" (e.g. "GET /users/:id")
   * @param {Object} [params.headers] - Optional headers pattern to match
   * @param {Array<string>} [params.availableContentTypes=[]] - Content types this route can produce
   * @param {Array<string>} [params.availableLanguages=[]] - Languages this route can respond with
   * @param {Array<string>} [params.availableEncodings=[]] - Encodings this route supports
   * @param {Array<string>} [params.acceptedContentTypes=[]] - Content types this route accepts (for POST/PATCH/PUT)
   * @param {Function} params.response - Function to generate response for matching requests
   * @throws {TypeError} If endpoint is not a string
   * @returns {void}
   */
  const add = ({
    endpoint,
    headers,
    availableContentTypes = [],
    availableLanguages = [],
    availableEncodings = [],
    acceptedContentTypes = [], // useful only for POST/PATCH/PUT
    response,
    websocket,
  }) => {
    if (!endpoint || typeof endpoint !== "string") {
      throw new TypeError(`endpoint must be a string, received ${endpoint}`);
    }
    const [method, resource] = endpoint === "*" ? ["* *"] : endpoint.split(" ");
    if (method !== "*" && !HTTP_METHODS.includes(method)) {
      throw new TypeError(`Invalid HTTP method: ${method}`);
    }
    if (resource[0] !== "/" && resource[0] !== "*") {
      throw new TypeError(`Resource must start with /, received ${resource}`);
    }
    if (websocket) {
      router.hasSomeWebsocketRoute = true;
    }
    const resourcePattern = createResourcePattern(resource);
    const headersPattern = headers ? createHeadersPattern(headers) : null;

    const route = {
      method,
      resource,
      availableContentTypes,
      availableLanguages,
      availableEncodings,
      acceptedContentTypes,
      matchMethod:
        method === "*"
          ? () => true
          : (requestMethod) => requestMethod === method,
      matchResource:
        resource === "*"
          ? () => true
          : (requestResource) => {
              return resourcePattern.match(requestResource);
            },
      matchHeaders:
        headers === undefined
          ? () => true
          : (requestHeaders) => {
              return headersPattern.match(requestHeaders);
            },
      response,
      websocket,
      toString: () => {
        return `${method} ${resource}`;
      },
      toJSON: () => {
        return {
          method,
          resource,
          availableContentTypes,
          availableLanguages,
          availableEncodings,
          acceptedContentTypes,
        };
      },
      resourcePattern,
    };
    routeSet.add(route);
  };
  const match = async (request, { injectResponseHeader } = {}) => {
    const allowedMethods = [];
    for (const route of routeSet) {
      if (route.websocket && request.headers["upgrade"] !== "websocket") {
        continue;
      }
      if (request.headers["upgrade"] === "websocket" && !route.websocket) {
        continue;
      }
      const resourceMatchResult = route.matchResource(request.resource);
      if (!resourceMatchResult) {
        continue;
      }
      if (!route.matchMethod(request.method)) {
        // we can already collect the fact resource has matched
        // in case nothing matches we can produce a response with Allow: GET, POST, PUT for example
        allowedMethods.push(route.method);
        continue;
      }
      const headersMatchResult = route.matchHeaders(request.headers);
      if (!headersMatchResult) {
        continue;
      }
      if (
        request.method === "POST" ||
        request.method === "PATCH" ||
        request.method === "PUT"
      ) {
        const { acceptedContentTypes } = route;
        if (
          acceptedContentTypes.length &&
          !isRequestBodyContentTypeSupported(request, { acceptedContentTypes })
        ) {
          return createUnsupportedMediaTypeResponse(request, {
            acceptedContentTypes,
          });
        }
      }

      // now we are "good", let's try to generate a response
      // now put negotiated stuff at the end
      const contentNegotiationResult = {};
      {
        const { availableContentTypes } = route;
        if (availableContentTypes.length) {
          const contentTypeNegotiated = pickContentType(
            request,
            availableContentTypes,
          );
          contentNegotiationResult.contentType = contentTypeNegotiated;
        }
        const { availableLanguages } = route;
        if (availableLanguages.length) {
          const contentLanguageNegotiated = pickContentLanguage(
            request,
            availableContentTypes,
          );
          contentNegotiationResult.contentLanguage = contentLanguageNegotiated;
        }
        const { availableEncodings } = route;
        if (availableEncodings.length) {
          const contentEncodingNegotiated = pickContentEncoding(
            request,
            availableEncodings,
          );
          contentNegotiationResult.contentEncoding = contentEncodingNegotiated;
        }
      }
      const { named, stars = [] } = PATTERN.composeTwoMatchResults(
        resourceMatchResult,
        headersMatchResult,
      );
      let responseReturnValue = route.response(
        request,
        {
          ...named,
          contentNegotiation: contentNegotiationResult,
        },
        ...stars,
      );
      if (
        responseReturnValue !== null &&
        typeof responseReturnValue === "object" &&
        typeof responseReturnValue.then === "function"
      ) {
        responseReturnValue = await responseReturnValue;
      }
      // he decided not to handle in the end
      if (responseReturnValue === null || responseReturnValue === undefined) {
        continue;
      }
      if (contentNegotiationResult.contentType) {
        injectResponseHeader("vary", "accept");
      }
      if (contentNegotiationResult.contentLanguage) {
        injectResponseHeader("vary", "accept-language");
      }
      if (contentNegotiationResult.contentEncoding) {
        injectResponseHeader("vary", "accept-encoding");
      }
      return responseReturnValue;
    }
    if (request.method === "OPTIONS") {
      const isForAnyRoute = request.resource === "*";
      if (isForAnyRoute) {
        const serverOPTIONS = inferServerOPTIONS();
        return createServerResourceOptionsResponse(request, serverOPTIONS);
      }
      const resourceOPTIONS = inferResourceOPTIONS(request);
      return createResourceOptionsResponse(request, resourceOPTIONS);
    }
    // nothing has matched fully
    // if nothing matches at all we'll send 404
    // but if url matched but METHOD was not supported we send 405
    if (allowedMethods.length) {
      return createMethodNotAllowedResponse(request, { allowedMethods });
    }
    constructAvailableEndpoints();
    return createRouteNotFoundResponse(request);
  };
  const inspect = () => {
    // I want all the info I can gather about the routes
    const data = [];
    for (const route of routeSet) {
      data.push(route.toJSON());
    }
    return data;
  };

  Object.assign(router, {
    add,
    match,
    inspect,
  });
  return router;
};

const isRequestBodyContentTypeSupported = (
  request,
  { acceptedContentTypes },
) => {
  const requestBodyContentType = request.headers["content-type"];
  if (!requestBodyContentType) {
    return false;
  }
  for (const acceptedContentType of acceptedContentTypes) {
    if (requestBodyContentType.includes(acceptedContentType)) {
      return true;
    }
  }
  return false;
};

const createServerResourceOptionsResponse = (
  request,
  { server, resourceOptionsMap },
) => {
  const headers = server.asResponseHeaders();
  const contentTypeNegotiated = pickContentType(request, [
    "application/json",
    "text/plain",
  ]);
  if (contentTypeNegotiated === "application/json") {
    const perResource = {};
    for (const [resource, resourceOptions] of resourceOptionsMap) {
      perResource[resource] = resourceOptions.toJSON();
    }
    return Response.json(
      {
        server: server.toJSON(),
        perResource,
      },
      { status: 200, headers },
    );
  }
  // text/plain
  return new Response(
    `The list of endpoints available can be seen at ${endpointInspectorUrl}`,
    { status: 200, headers },
  );
};
const createResourceOptionsResponse = (request, resourceOptions) => {
  const headers = resourceOptions.asResponseHeaders();
  return new Response(undefined, { status: 204, headers });
};
const createMethodNotAllowedResponse = (
  request,
  { allowedMethods = [] } = {},
) => {
  return createClientErrorResponse(request, {
    status: 405,
    statusText: "Method Not Allowed",
    headers: {
      allow: allowedMethods.join(", "),
    },
    message: {
      text: `The HTTP method ${request.method} is not supported for this resource.
Allowed methods: ${allowedMethods.join(", ")}`,
      html: `The HTTP method <strong>${request.method}</strong> is not supported for this resource.<br />
Allowed methods: <strong>${allowedMethods.join(", ")}</strong>`,
    },
    data: {
      requestMethod: request.method,
      allowedMethods,
    },
  });
};
const createUnsupportedMediaTypeResponse = (
  request,
  { acceptedContentTypes },
) => {
  const requestMediaType = request.headers["content-type"];

  return createClientErrorResponse(request, {
    status: 415,
    statusText: "Unsupported Media Type",
    headers: {
      "supported-media": acceptedContentTypes.join(", "),
    },
    message: {
      text: requestMediaType
        ? `The media type "${requestMediaType}" is not supported for this resource.
Supported media types: ${acceptedContentTypes.join(", ")}`
        : `The media type was not specified in the request "content-type" header`,
      html: requestMediaType
        ? `The media type <strong>${requestMediaType}</strong> is not supported for this resource.<br />
Supported media types: <strong>${acceptedContentTypes.join(", ")}</strong>`
        : `The media type was not specified in the request "content-type" header`,
    },
    data: {
      requestMediaType,
      acceptedContentTypes,
    },
  });
};
const createRouteNotFoundResponse = (request) => {
  return createClientErrorResponse(request, {
    status: 404,
    statusText: "Not Found",
    message: {
      text: `The URL ${request.resource} does not exists on this server.
The list of existing endpoints is available at ${endpointInspectorUrl}`,
      html: `The URL <strong>${request.resource}</strong> does not exists on this server.<br />
The list of existing endpoints is available at:
<a href="${endpointInspectorUrl}">${endpointInspectorUrl}</a>`,
    },
  });
};

const createClientErrorResponse = (
  request,
  { status, statusText, headers, message, data },
) => {
  const contentTypeNegotiated = pickContentType(request, [
    "application/json",
    "text/html",
    "text/plain",
  ]);
  if (contentTypeNegotiated === "text/html") {
    const htmlTemplate = readFileSync(
      new URL(clientErrorHtmlTemplateFileUrl),
      "utf8",
    );
    const html = replacePlaceholdersInHtml(htmlTemplate, {
      message: message.html,
      status,
      statusText,
      ...data,
    });
    return new Response(html, {
      status,
      statusText,
      headers: { ...headers, "content-type": "text/html" },
    });
  }
  if (contentTypeNegotiated === "application/json") {
    return Response.json({ data }, { status, statusText, headers });
  }
  return new Response(message.text, { status, statusText, headers });
};

// to predict order in chrome devtools we should put a,b,c,d,e or something
// because in chrome dev tools they are shown in alphabetic order
// also we should manipulate a timing object instead of a header to facilitate
// manipulation of the object so that the timing header response generation logic belongs to @jsenv/server
// so response can return a new timing object
// yes it's awful, feel free to PR with a better approach :)
const timingToServerTimingResponseHeaders = (timing) => {
  const serverTimingHeader = {};
  Object.keys(timing).forEach((key, index) => {
    const name = letters[index] || "zz";
    serverTimingHeader[name] = {
      desc: key,
      dur: timing[key],
    };
  });
  const serverTimingHeaderString =
    stringifyServerTimingHeader(serverTimingHeader);

  return { "server-timing": serverTimingHeaderString };
};

const stringifyServerTimingHeader = (serverTimingHeader) => {
  return stringifyMultipleHeader(serverTimingHeader, {
    validateName: validateServerTimingName,
  });
};

// (),/:;<=>?@[\]{}" Don't allowed
// Minimal length is one symbol
// Digits, alphabet characters,
// and !#$%&'*+-.^_`|~ are allowed
// https://www.w3.org/TR/2019/WD-server-timing-20190307/#the-server-timing-header-field
// https://tools.ietf.org/html/rfc7230#section-3.2.6
const validateServerTimingName = (name) => {
  const valid = /^[!#$%&'*+\-.^_`|~0-9a-z]+$/i.test(name);
  if (!valid) {
    console.warn(`server timing contains invalid symbols`);
    return false;
  }
  return true;
};

const letters = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
];

const timeStart = (name) => {
  // as specified in https://w3c.github.io/server-timing/#the-performanceservertiming-interface
  // duration is a https://www.w3.org/TR/hr-time-2/#sec-domhighrestimestamp
  const startTimestamp = performance$1.now();
  const timeEnd = () => {
    const endTimestamp = performance$1.now();
    const timing = {
      [name]: endTimestamp - startTimestamp,
    };
    return timing;
  };
  return timeEnd;
};

const timeFunction = (name, fn) => {
  const timeEnd = timeStart(name);
  const returnValue = fn();
  if (returnValue && typeof returnValue.then === "function") {
    return returnValue.then((value) => {
      return [timeEnd(), value];
    });
  }
  return [timeEnd(), returnValue];
};

const HOOK_NAMES = [
  "serverListening",
  "redirectRequest",
  "handleRequest",
  "routes",
  "handleWebsocket",
  "handleError",
  "onResponsePush",
  "injectResponseHeaders",
  "responseReady",
  "serverStopped",
];

const createServiceController = (services) => {
  const hookSetMap = new Map();

  const addHook = (hook) => {
    let hookSet = hookSetMap.get(hook.name);
    if (!hookSet) {
      hookSet = new Set();
      hookSetMap.set(hook.name, hookSet);
    }
    hookSet.add(hook);
  };

  const addService = (service) => {
    for (const key of Object.keys(service)) {
      if (key === "name") continue;
      const isHook = HOOK_NAMES.includes(key);
      if (!isHook) {
        console.warn(
          `Unexpected "${key}" property on "${service.name}" service`,
        );
      }
      const hookName = key;
      const hookValue = service[hookName];
      if (!hookValue) {
        continue;
      }
      if (hookName === "routes") ; else {
        addHook({
          service,
          name: hookName,
          value: hookValue,
        });
      }
    }
  };

  for (const service of services) {
    addService(service);
  }

  let currentService = null;
  let currentHookName = null;
  const callHook = (hook, info, context) => {
    const hookFn = getHookFunction(hook, info);
    if (!hookFn) {
      return null;
    }
    currentService = hook.service;
    currentHookName = hook.name;
    let timeEnd;
    if (context && context.timing) {
      timeEnd = timeStart(
        `${currentService.name.replace("jsenv:", "")}.${currentHookName}`,
      );
    }
    let valueReturned = hookFn(info, context);
    if (context && context.timing) {
      Object.assign(context.timing, timeEnd());
    }
    currentService = null;
    currentHookName = null;
    return valueReturned;
  };
  const callAsyncHook = async (hook, info, context) => {
    const hookFn = getHookFunction(hook, info);
    if (!hookFn) {
      return null;
    }
    currentService = hook.service;
    currentHookName = hook.name;
    let timeEnd;
    if (context && context.timing) {
      timeEnd = timeStart(
        `${currentService.name.replace("jsenv:", "")}.${currentHookName}`,
      );
    }
    let valueReturned = await hookFn(info, context);
    if (context && context.timing) {
      Object.assign(context.timing, timeEnd());
    }
    currentService = null;
    currentHookName = null;
    return valueReturned;
  };

  const callHooks = (hookName, info, context, callback = () => {}) => {
    const hookSet = hookSetMap.get(hookName);
    if (!hookSet) {
      return;
    }
    for (const hook of hookSet) {
      const returnValue = callHook(hook, info, context);
      if (returnValue) {
        callback(returnValue);
      }
    }
  };
  const callHooksUntil = (
    hookName,
    info,
    context,
    until = (returnValue) => returnValue,
  ) => {
    const hookSet = hookSetMap.get(hookName);
    if (!hookSet) {
      return null;
    }
    for (const hook of hookSet) {
      const returnValue = callHook(hook, info, context);
      const untilReturnValue = until(returnValue);
      if (untilReturnValue) {
        return untilReturnValue;
      }
    }
    return null;
  };
  const callAsyncHooksUntil = async (hookName, info, context) => {
    const hookSet = hookSetMap.get(hookName);
    if (!hookSet) {
      return null;
    }
    if (hookSet.size === 0) {
      return null;
    }
    const iterator = hookSet.values()[Symbol.iterator]();
    let result;
    const visit = async () => {
      const { done, value: hook } = iterator.next();
      if (done) {
        return;
      }
      const returnValue = await callAsyncHook(hook, info, context);
      if (returnValue) {
        result = returnValue;
        return;
      }
      await visit();
    };
    await visit();
    return result;
  };

  return {
    services,

    callHooks,
    callHooksUntil,
    callAsyncHooksUntil,

    getCurrentService: () => currentService,
    getCurrentHookName: () => currentHookName,
  };
};

const getHookFunction = (hook, info) => {
  const hookValue = hook.value;
  if (hook.name === "handleRequest" && typeof hookValue === "object") {
    const request = info;
    const hookForMethod = hookValue[request.method] || hookValue["*"];
    if (!hookForMethod) {
      return null;
    }
    return hookForMethod;
  }
  return hookValue;
};

const flattenAndFilterServices = (services) => {
  const flatServices = [];
  const visitServiceEntry = (serviceEntry) => {
    if (Array.isArray(serviceEntry)) {
      serviceEntry.forEach((value) => visitServiceEntry(value));
      return;
    }
    if (typeof serviceEntry === "object" && serviceEntry !== null) {
      if (!serviceEntry.name) {
        serviceEntry.name = "anonymous";
      }
      flatServices.push(serviceEntry);
      return;
    }
    throw new Error(`services must be objects, got ${serviceEntry}`);
  };
  services.forEach((serviceEntry) => visitServiceEntry(serviceEntry));
  return flatServices;
};

const jsenvServiceAutoreloadOnRestart = () => {
  return {
    name: "jsenv:autoreload_on_server_restart",

    routes: [
      {
        endpoint: "GET *",
        headers: {
          "upgrade": "websocket",
          "sec-websocket-protocol": "jsenv_server",
        },
        websocket: true,
        response: () => {
          return new Response("hello world");
        },
      },
    ],
  };
};

import.meta.resolve("../");

const createReason = (reasonString) => {
  return {
    toString: () => reasonString,
  };
};

const STOP_REASON_INTERNAL_ERROR = createReason("Internal error");
const STOP_REASON_PROCESS_SIGHUP = createReason("process SIGHUP");
const STOP_REASON_PROCESS_SIGTERM = createReason("process SIGTERM");
const STOP_REASON_PROCESS_SIGINT = createReason("process SIGINT");
const STOP_REASON_PROCESS_BEFORE_EXIT = createReason(
  "process before exit",
);
const STOP_REASON_PROCESS_EXIT = createReason("process exit");
const STOP_REASON_NOT_SPECIFIED = createReason("not specified");

const applyDnsResolution = async (
  hostname,
  { verbatim = false } = {},
) => {
  const dnsResolution = await new Promise((resolve, reject) => {
    lookup(hostname, { verbatim }, (error, address, family) => {
      if (error) {
        reject(error);
      } else {
        resolve({ address, family });
      }
    });
  });
  return dnsResolution;
};

const parseHostname = (hostname) => {
  if (hostname === "0.0.0.0") {
    return {
      type: "ip",
      label: "unspecified",
      version: 4,
    };
  }
  if (
    hostname === "::" ||
    hostname === "0000:0000:0000:0000:0000:0000:0000:0000"
  ) {
    return {
      type: "ip",
      label: "unspecified",
      version: 6,
    };
  }
  if (hostname === "127.0.0.1") {
    return {
      type: "ip",
      label: "loopback",
      version: 4,
    };
  }
  if (
    hostname === "::1" ||
    hostname === "0000:0000:0000:0000:0000:0000:0000:0001"
  ) {
    return {
      type: "ip",
      label: "loopback",
      version: 6,
    };
  }
  const ipVersion = isIP(hostname);
  if (ipVersion === 0) {
    return {
      type: "hostname",
    };
  }
  return {
    type: "ip",
    version: ipVersion,
  };
};

const createIpGetters = () => {
  const networkAddresses = [];
  const networkInterfaceMap = networkInterfaces();
  for (const key of Object.keys(networkInterfaceMap)) {
    for (const networkAddress of networkInterfaceMap[key]) {
      networkAddresses.push(networkAddress);
    }
  }
  return {
    getFirstInternalIp: ({ preferIpv6 }) => {
      const isPref = preferIpv6 ? isIpV6 : isIpV4;
      let firstInternalIp;
      for (const networkAddress of networkAddresses) {
        if (networkAddress.internal) {
          firstInternalIp = networkAddress.address;
          if (isPref(networkAddress)) {
            break;
          }
        }
      }
      return firstInternalIp;
    },
    getFirstExternalIp: ({ preferIpv6 }) => {
      const isPref = preferIpv6 ? isIpV6 : isIpV4;
      let firstExternalIp;
      for (const networkAddress of networkAddresses) {
        if (!networkAddress.internal) {
          firstExternalIp = networkAddress.address;
          if (isPref(networkAddress)) {
            break;
          }
        }
      }
      return firstExternalIp;
    },
  };
};

const isIpV4 = (networkAddress) => {
  // node 18.5
  if (typeof networkAddress.family === "number") {
    return networkAddress.family === 4;
  }
  return networkAddress.family === "IPv4";
};

const isIpV6 = (networkAddress) => !isIpV4(networkAddress);

const startServer = async ({
  signal = new AbortController().signal,
  logLevel,
  startLog = true,
  serverName = "server",

  https = false,
  http2 = false,
  http1Allowed = true,
  redirectHttpToHttps,
  allowHttpRequestOnHttps = false,
  acceptAnyIp = false,
  preferIpv6,
  hostname = "localhost",
  port = 0, // assign a random available port
  portHint,

  // when inside a worker, we should not try to stop server on SIGINT
  // otherwise it can create an EPIPE error while primary process tries
  // to kill the server
  stopOnSIGINT = !cluster.isWorker,
  // auto close the server when the process exits
  stopOnExit = true,
  // auto close when requestToResponse throw an error
  stopOnInternalError = false,
  keepProcessAlive = true,
  routes = [],
  services = [],
  nagle = true,
  serverTiming = false,
  requestWaitingMs = 0,
  requestWaitingCallback = ({ request, warn, requestWaitingMs }) => {
    warn(
      createDetailedMessage(
        `still no response found for request after ${requestWaitingMs} ms`,
        {
          "request url": request.url,
          "request headers": JSON.stringify(request.headers, null, "  "),
        },
      ),
    );
  },
  // timeAllocated to start responding to a request
  // after this delay the server will respond with 504
  responseTimeout = 60_000 * 10, // 10s
  // time allocated to server code to start reading the request body
  // after this delay the underlying stream is destroyed, attempting to read it would throw
  // if used the stream stays opened, it's only if the stream is not read at all that it gets destroyed
  requestBodyLifetime = 60_000 * 2, // 2s
  ...rest
} = {}) => {
  // param validations
  {
    const unexpectedParamNames = Object.keys(rest);
    if (unexpectedParamNames.length > 0) {
      throw new TypeError(
        `${unexpectedParamNames.join(",")}: there is no such param`,
      );
    }
    if (https) {
      if (typeof https !== "object") {
        throw new TypeError(`https must be an object, got ${https}`);
      }
      const { certificate, privateKey } = https;
      if (!certificate || !privateKey) {
        throw new TypeError(
          `https must be an object with { certificate, privateKey }`,
        );
      }
    }
    if (http2 && !https) {
      throw new Error(`http2 needs https`);
    }
  }
  const logger = createLogger({ logLevel });
  // param warnings and normalization
  {
    if (
      redirectHttpToHttps === undefined &&
      https &&
      !allowHttpRequestOnHttps
    ) {
      redirectHttpToHttps = true;
    }
    if (redirectHttpToHttps && !https) {
      logger.warn(`redirectHttpToHttps ignored because protocol is http`);
      redirectHttpToHttps = false;
    }
    if (allowHttpRequestOnHttps && redirectHttpToHttps) {
      logger.warn(
        `redirectHttpToHttps ignored because allowHttpRequestOnHttps is enabled`,
      );
      redirectHttpToHttps = false;
    }

    if (allowHttpRequestOnHttps && !https) {
      logger.warn(`allowHttpRequestOnHttps ignored because protocol is http`);
      allowHttpRequestOnHttps = false;
    }
  }

  const server = {};
  const router = createRouter();
  services = [
    jsenvServiceRouting(router),
    ...(// after build internal client files are inlined, no need for this service anymore
        []
      ),
    jsenvServiceAutoreloadOnRestart(),
    ...flattenAndFilterServices(services),
  ];
  for (const route of routes) {
    router.add(route);
  }
  for (const service of services) {
    const serviceRoutes = service.routes;
    if (serviceRoutes) {
      for (const serviceRoute of serviceRoutes) {
        router.add(serviceRoute);
      }
    }
  }

  const serviceController = createServiceController(services);
  const processTeardownEvents = {
    SIGHUP: stopOnExit,
    SIGTERM: stopOnExit,
    SIGINT: stopOnSIGINT,
    beforeExit: stopOnExit,
    exit: stopOnExit,
  };

  let status = "starting";
  let nodeServer;
  const startServerOperation = Abort.startOperation();
  const stopCallbackSet = new Set();
  const serverOrigins = {
    local: "", // favors hostname when possible
  };

  try {
    startServerOperation.addAbortSignal(signal);
    startServerOperation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(processTeardownEvents, ({ name }) => {
        logger.info(`process teardown (${name}) -> aborting start server`);
        abort();
      });
    });
    startServerOperation.throwIfAborted();
    nodeServer = await createNodeServer({
      https,
      redirectHttpToHttps,
      allowHttpRequestOnHttps,
      http2,
      http1Allowed,
    });
    startServerOperation.throwIfAborted();

    // https://nodejs.org/api/net.html#net_server_unref
    if (!keepProcessAlive) {
      nodeServer.unref();
    }

    const createOrigin = (hostname) => {
      const protocol = https ? "https" : "http";
      if (isIP(hostname) === 6) {
        return `${protocol}://[${hostname}]`;
      }
      return `${protocol}://${hostname}`;
    };

    const ipGetters = createIpGetters();
    let hostnameToListen;
    if (acceptAnyIp) {
      const firstInternalIp = ipGetters.getFirstInternalIp({ preferIpv6 });
      serverOrigins.local = createOrigin(firstInternalIp);
      serverOrigins.localip = createOrigin(firstInternalIp);
      const firstExternalIp = ipGetters.getFirstExternalIp({ preferIpv6 });
      serverOrigins.externalip = createOrigin(firstExternalIp);
      hostnameToListen = preferIpv6 ? "::" : "0.0.0.0";
    } else {
      hostnameToListen = hostname;
    }
    const hostnameInfo = parseHostname(hostname);
    if (hostnameInfo.type === "ip") {
      if (acceptAnyIp) {
        throw new Error(
          `hostname cannot be an ip when acceptAnyIp is enabled, got ${hostname}`,
        );
      }

      preferIpv6 = hostnameInfo.version === 6;
      const firstInternalIp = ipGetters.getFirstInternalIp({ preferIpv6 });
      serverOrigins.local = createOrigin(firstInternalIp);
      serverOrigins.localip = createOrigin(firstInternalIp);
      if (hostnameInfo.label === "unspecified") {
        const firstExternalIp = ipGetters.getFirstExternalIp({ preferIpv6 });
        serverOrigins.externalip = createOrigin(firstExternalIp);
      } else if (hostnameInfo.label === "loopback") {
        // nothing
      } else {
        serverOrigins.local = createOrigin(hostname);
      }
    } else {
      const hostnameDnsResolution = await applyDnsResolution(hostname, {
        verbatim: true,
      });
      if (hostnameDnsResolution) {
        const hostnameIp = hostnameDnsResolution.address;
        serverOrigins.localip = createOrigin(hostnameIp);
        serverOrigins.local = createOrigin(hostname);
      } else {
        const firstInternalIp = ipGetters.getFirstInternalIp({ preferIpv6 });
        // fallback to internal ip because there is no ip
        // associated to this hostname on operating system (in hosts file)
        hostname = firstInternalIp;
        hostnameToListen = firstInternalIp;
        serverOrigins.local = createOrigin(firstInternalIp);
      }
    }

    port = await listen({
      signal: startServerOperation.signal,
      server: nodeServer,
      port,
      portHint,
      hostname: hostnameToListen,
    });

    // normalize origins (remove :80 when port is 80 for instance)
    Object.keys(serverOrigins).forEach((key) => {
      serverOrigins[key] = new URL(`${serverOrigins[key]}:${port}`).origin;
    });

    serviceController.callHooks("serverListening", { port });
    startServerOperation.addAbortCallback(async () => {
      await stopListening(nodeServer);
    });
    startServerOperation.throwIfAborted();
  } finally {
    await startServerOperation.end();
  }

  // the main server origin
  // - when protocol is http
  //   node-fetch do not apply local dns resolution to map localhost back to 127.0.0.1
  //   despites localhost being mapped so we prefer to use the internal ip
  //   (127.0.0.1)
  // - when protocol is https
  //   using the hostname becomes important because the certificate is generated
  //   for hostnames, not for ips
  //   so we prefer https://locahost or https://local_hostname
  //   over the ip
  const serverOrigin = serverOrigins.local;

  // now the server is started (listening) it cannot be aborted anymore
  // (otherwise an AbortError is thrown to the code calling "startServer")
  // we can proceed to create a stop function to stop it gacefully
  // and add a request handler
  stopCallbackSet.add(({ reason }) => {
    logger.info(`${serverName} stopping server (reason: ${reason})`);
  });
  stopCallbackSet.add(async () => {
    await stopListening(nodeServer);
  });
  let stoppedResolve;
  const stoppedPromise = new Promise((resolve) => {
    stoppedResolve = resolve;
  });
  const stop = memoize(async (reason = STOP_REASON_NOT_SPECIFIED) => {
    status = "stopping";
    const promises = [];
    for (const stopCallback of stopCallbackSet) {
      promises.push(stopCallback({ reason }));
    }
    stopCallbackSet.clear();
    await Promise.all(promises);
    serviceController.callHooks("serverStopped", { reason });
    status = "stopped";
    stoppedResolve(reason);
  });
  let stopAbortSignal;
  {
    let stopAbortController = new AbortController();
    stopCallbackSet.add(() => {
      stopAbortController.abort();
      stopAbortController = undefined;
    });
    stopAbortSignal = stopAbortController.signal;
  }

  const cancelProcessTeardownRace = raceProcessTeardownEvents(
    processTeardownEvents,
    (winner) => {
      stop(PROCESS_TEARDOWN_EVENTS_MAP[winner.name]);
    },
  );
  stopCallbackSet.add(cancelProcessTeardownRace);

  const onError = (error) => {
    if (status === "stopping" && error.code === "ECONNRESET") {
      return;
    }
    throw error;
  };

  status = "opened";

  const removeConnectionErrorListener = listenServerConnectionError(
    nodeServer,
    onError,
  );
  stopCallbackSet.add(removeConnectionErrorListener);

  const connectionsTracker = trackServerPendingConnections(nodeServer, {
    http2,
  });
  // opened connection must be shutdown before the close event is emitted
  stopCallbackSet.add(connectionsTracker.stop);

  const pendingRequestsTracker = trackServerPendingRequests(nodeServer, {
    http2,
  });
  // ensure pending requests got a response from the server
  stopCallbackSet.add((reason) => {
    pendingRequestsTracker.stop({
      status: reason === STOP_REASON_INTERNAL_ERROR ? 500 : 503,
      reason,
    });
  });

  {
    const getResponseProperties = async (request, { pushResponse }) => {
      let requestReceivedMeasure;
      if (serverTiming) {
        requestReceivedMeasure = performance.now();
      }
      request.logger.info(
        request.parent
          ? `Push ${request.resource}`
          : request.headers["upgrade"] === "websocket"
            ? `${request.method} ${request.url} ${websocketSuffixColorized}`
            : `${request.method} ${request.url}`,
      );
      let requestWaitingTimeout;
      if (requestWaitingMs) {
        requestWaitingTimeout = setTimeout(
          () =>
            requestWaitingCallback({
              request,
              requestWaitingMs,
            }),
          requestWaitingMs,
        ).unref();
      }

      serviceController.callHooks(
        "redirectRequest",
        request,
        {},
        (newRequestProperties) => {
          if (newRequestProperties) {
            request = applyRedirectionToRequest(request, {
              original: request.original || request,
              previous: request,
              ...newRequestProperties,
            });
          }
        },
      );

      let handleRequestReturnValue;
      let errorWhileHandlingRequest = null;
      let handleRequestTimings = serverTiming ? {} : null;

      let timeout;
      const timeoutPromise = new Promise((resolve) => {
        timeout = setTimeout(() => {
          resolve({
            // the correct status code should be 500 because it's
            // we don't really know what takes time
            // in practice it's often because server is trying to reach an other server
            // that is not responding so 504 is more correct
            status: 504,
            statusText: `server timeout after ${
              responseTimeout / 1000
            }s waiting to handle request`,
          });
        }, responseTimeout);
      });
      const handleRequestPromise = serviceController.callAsyncHooksUntil(
        "handleRequest",
        request,
        {
          timing: handleRequestTimings,
          pushResponse,
        },
      );
      try {
        handleRequestReturnValue = await Promise.race([
          timeoutPromise,
          handleRequestPromise,
        ]);
      } catch (e) {
        errorWhileHandlingRequest = e;
      }
      clearTimeout(timeout);

      let responseProperties;
      if (errorWhileHandlingRequest) {
        if (
          errorWhileHandlingRequest.name === "AbortError" &&
          request.signal.aborted
        ) {
          responseProperties = { requestAborted: true };
        } else {
          // internal error, create 500 response
          if (
            // stopOnInternalError stops server only if requestToResponse generated
            // a non controlled error (internal error).
            // if requestToResponse gracefully produced a 500 response (it did not throw)
            // then we can assume we are still in control of what we are doing
            stopOnInternalError
          ) {
            // il faudrais pouvoir stop que les autres response ?
            stop(STOP_REASON_INTERNAL_ERROR);
          }
          const handleErrorReturnValue =
            await serviceController.callAsyncHooksUntil(
              "handleError",
              errorWhileHandlingRequest,
              { request },
            );
          if (!handleErrorReturnValue) {
            throw errorWhileHandlingRequest;
          }
          request.logger.error(
            createDetailedMessage(`internal error while handling request`, {
              "error stack": errorWhileHandlingRequest.stack,
            }),
          );
          responseProperties = composeTwoResponses(
            {
              status: 500,
              statusText: "Internal Server Error",
              headers: {
                // ensure error are not cached
                "cache-control": "no-store",
                "content-type": "text/plain",
              },
            },
            handleErrorReturnValue,
          );
        }
      } else {
        let status;
        let statusText;
        let statusMessage;
        let headers;
        let body;
        if (handleRequestReturnValue instanceof Response) {
          status = handleRequestReturnValue.status;
          statusText = handleRequestReturnValue.statusText;
          headers = {};
          for (const [name, value] of handleRequestReturnValue.headers) {
            headers[name] = value;
          }
          body = handleRequestReturnValue.body;
        } else if (
          handleRequestReturnValue !== null &&
          typeof handleRequestReturnValue === "object"
        ) {
          status = handleRequestReturnValue.status;
          statusText = handleRequestReturnValue.statusText;
          statusMessage = handleRequestReturnValue.statusMessage;
          headers = handleRequestReturnValue.headers;
          body = handleRequestReturnValue.body;
          if (status === undefined) {
            status = 404;
          }
          if (headers === undefined) {
            headers = {};
          }
        } else {
          throw new TypeError(
            `response must be a Response, or an Object, received ${handleRequestReturnValue}`,
          );
        }
        responseProperties = {
          status,
          statusText,
          statusMessage,
          headers,
          body,
        };
      }

      if (serverTiming) {
        const responseReadyMeasure = performance.now();
        const timeToStartResponding =
          responseReadyMeasure - requestReceivedMeasure;
        const serverTiming = {
          ...handleRequestTimings,
          ...responseProperties.timing,
          "time to start responding": timeToStartResponding,
        };
        responseProperties.headers = composeTwoHeaders(
          responseProperties.headers,
          timingToServerTimingResponseHeaders(serverTiming),
        );
      }
      if (requestWaitingMs) {
        clearTimeout(requestWaitingTimeout);
      }
      if (
        request.method !== "HEAD" &&
        responseProperties.headers["content-length"] > 0 &&
        !responseProperties.body
      ) {
        request.logger.warn(
          `content-length header is ${responseProperties.headers["content-length"]} but body is empty`,
        );
      }
      serviceController.callHooks(
        "injectResponseHeaders",
        responseProperties,
        {
          request,
        },
        (returnValue) => {
          if (returnValue) {
            responseProperties.headers = composeTwoHeaders(
              responseProperties.headers,
              returnValue,
            );
          }
        },
      );
      serviceController.callHooks("responseReady", responseProperties, {
        request,
      });
      return responseProperties;
    };

    const requestEventHandler = async (nodeRequest, nodeResponse) => {
      if (redirectHttpToHttps && !nodeRequest.connection.encrypted) {
        nodeResponse.writeHead(301, {
          location: `${serverOrigin}${nodeRequest.url}`,
        });
        nodeResponse.end();
        return;
      }
      try {
        // eslint-disable-next-line no-new
        new URL(nodeRequest.url, "http://example.com/");
      } catch {
        nodeResponse.writeHead(400, "Request url is not supported");
        nodeResponse.end();
        return;
      }

      const receiveRequestOperation = Abort.startOperation();
      receiveRequestOperation.addAbortSignal(stopAbortSignal);
      const sendResponseOperation = Abort.startOperation();
      sendResponseOperation.addAbortSignal(stopAbortSignal);
      receiveRequestOperation.addAbortSource((abort) => {
        const closeEventCallback = () => {
          if (nodeRequest.complete) {
            receiveRequestOperation.end();
          } else {
            nodeResponse.destroy();
            abort();
          }
        };
        nodeRequest.once("close", closeEventCallback);
        return () => {
          nodeRequest.removeListener("close", closeEventCallback);
        };
      });
      sendResponseOperation.addAbortSignal(receiveRequestOperation.signal);

      const request = fromNodeRequest(nodeRequest, {
        signal: stopAbortSignal,
        serverOrigin,
        requestBodyLifetime,
        logger,
      });

      const sendResponse = async (
        responseStream,
        responseProperties,
        { signal, request },
      ) => {
        // When "pushResponse" is called and the parent response has no body
        // the parent response is immediatly ended. It means child responses (pushed streams)
        // won't get a chance to be pushed.
        // To let a chance to pushed streams we wait a little before sending the response
        const ignoreBody = request.method === "HEAD";
        const bodyIsEmpty = !responseProperties.body || ignoreBody;
        if (bodyIsEmpty && request.logger.hasPushChild) {
          await new Promise((resolve) => setTimeout(resolve));
        }
        await writeNodeResponse(responseStream, responseProperties, {
          signal,
          ignoreBody,
          onAbort: () => {
            request.logger.info(`response aborted`);
            request.logger.end();
          },
          onError: (error) => {
            request.logger.error(
              createDetailedMessage(`An error occured while sending response`, {
                "error stack": error.stack,
              }),
            );
            request.logger.end();
          },
          onHeadersSent: ({ status, statusText }) => {
            request.logger.onHeadersSent({
              status,
              statusText: responseProperties.statusMessage || statusText,
            });
            request.logger.end();
          },
          onEnd: () => {
            request.logger.end();
          },
        });
      };

      try {
        if (receiveRequestOperation.signal.aborted) {
          return;
        }
        // pause the stream to let a chance to "handleRequest" to read request body.
        // Without this the request body readable stream
        // might be closed when we'll try to attach "data" and "end" listeners to it
        nodeRequest.pause();
        if (!nagle) {
          nodeRequest.connection.setNoDelay(true);
        }
        const responseProperties = await getResponseProperties(request, {
          pushResponse: async ({ path, method }) => {
            const pushRequestLogger = request.logger.forPush();
            if (typeof path !== "string" || path[0] !== "/") {
              pushRequestLogger.warn(
                `response push ignored because path is invalid (must be a string starting with "/", found ${path})`,
              );
              return;
            }
            if (!request.http2) {
              pushRequestLogger.warn(
                `response push ignored because request is not http2`,
              );
              return;
            }
            const canPushStream = testCanPushStream(nodeResponse.stream);
            if (!canPushStream.can) {
              pushRequestLogger.debug(
                `response push ignored because ${canPushStream.reason}`,
              );
              return;
            }

            let preventedByService = null;
            const prevent = () => {
              preventedByService = serviceController.getCurrentService();
            };
            serviceController.callHooksUntil(
              "onResponsePush",
              { path, method },
              { request, prevent },
              () => preventedByService,
            );
            if (preventedByService) {
              pushRequestLogger.debug(
                `response push prevented by "${preventedByService.name}" service`,
              );
              return;
            }

            const http2Stream = nodeResponse.stream;

            // being able to push a stream is nice to have
            // so when it fails it's not critical
            const onPushStreamError = (e) => {
              pushRequestLogger.error(
                createDetailedMessage(
                  `An error occured while pushing a stream to the response for ${request.resource}`,
                  {
                    "error stack": e.stack,
                  },
                ),
              );
            };

            // not aborted, let's try to push a stream into that response
            // https://nodejs.org/docs/latest-v16.x/api/http2.html#http2streampushstreamheaders-options-callback
            let pushStream;
            try {
              pushStream = await new Promise((resolve, reject) => {
                http2Stream.pushStream(
                  {
                    ":path": path,
                    ...(method ? { ":method": method } : {}),
                  },
                  async (
                    error,
                    pushStream,
                    // headers
                  ) => {
                    if (error) {
                      reject(error);
                    }
                    resolve(pushStream);
                  },
                );
              });
            } catch (e) {
              onPushStreamError(e);
              return;
            }

            const abortController = new AbortController();
            // It's possible to get NGHTTP2_REFUSED_STREAM errors here
            // https://github.com/nodejs/node/issues/20824
            const pushErrorCallback = (error) => {
              onPushStreamError(error);
              abortController.abort();
            };
            pushStream.on("error", pushErrorCallback);
            sendResponseOperation.addEndCallback(() => {
              pushStream.removeListener("error", onPushStreamError);
            });

            await sendResponseOperation.withSignal(async (signal) => {
              const pushResponseOperation = Abort.startOperation();
              pushResponseOperation.addAbortSignal(signal);
              pushResponseOperation.addAbortSignal(abortController.signal);

              const pushRequest = createPushRequest(request, {
                signal: pushResponseOperation.signal,
                pathname: path,
                method,
                logger: pushRequestLogger,
              });

              try {
                const responseProperties = await getResponseProperties(
                  pushRequest,
                  {
                    pushResponse: () => {
                      pushRequest.logger.warn(
                        `response push ignored because nested push is not supported`,
                      );
                    },
                  },
                );
                if (!abortController.signal.aborted) {
                  if (pushStream.destroyed) {
                    abortController.abort();
                  } else if (!http2Stream.pushAllowed) {
                    abortController.abort();
                  } else if (responseProperties.requestAborted) {
                  } else {
                    const responseLength =
                      responseProperties.headers["content-length"] || 0;
                    const { effectiveRecvDataLength, remoteWindowSize } =
                      http2Stream.session.state;
                    if (
                      effectiveRecvDataLength + responseLength >
                      remoteWindowSize
                    ) {
                      pushRequest.logger.debug(
                        `Aborting stream to prevent exceeding remoteWindowSize`,
                      );
                      abortController.abort();
                    }
                  }
                }
                await sendResponse(pushStream, responseProperties, {
                  signal: pushResponseOperation.signal,
                  request: pushRequest,
                });
              } finally {
                await pushResponseOperation.end();
              }
            });
          },
        });
        nodeRequest.resume();
        if (receiveRequestOperation.signal.aborted) {
          return;
        }
        // the node request readable stream is never closed because
        // the response headers contains "connection: keep-alive"
        // In this scenario we want to disable READABLE_STREAM_TIMEOUT warning
        if (responseProperties.headers.connection === "keep-alive") {
          clearTimeout(request.body.timeout);
        }
        await sendResponse(nodeResponse, responseProperties, {
          signal: sendResponseOperation.signal,
          request,
        });
      } finally {
        await sendResponseOperation.end();
      }
    };

    websocket: {
      // https://github.com/websockets/ws/blob/master/doc/ws.md#class-websocket
      if (!router.hasSomeWebsocketRoute) {
        break websocket;
      }
      const websocketOrigin = https
        ? `wss://${hostname}:${port}`
        : `ws://${hostname}:${port}`;
      server.websocketOrigin = websocketOrigin;
      const websocketClientSet = new Set();
      const { WebSocketServer } = await import("ws");
      let websocketServer = new WebSocketServer({ noServer: true });

      const upgradeEventHandler = async (nodeRequest, socket, head) => {
        const request = fromNodeRequest(nodeRequest, {
          signal: stopAbortSignal,
          serverOrigin,
          requestBodyLifetime,
          logger,
        });
        const responseProperties = await getResponseProperties(request, {});
        // https://github.com/websockets/ws/blob/b92745a9d6760e6b4b2394bfac78cbcd258a8c8d/lib/websocket-server.js#L491
        let {
          status,
          statusText = statusTextFromStatus(status),
          headers,
          body,
        } = responseProperties;

        if (status !== 200) {
          body = await body;
          headers = {
            connection: "close",
            ...headers,
          };
          if (body && headers["content-length"] === undefined) {
            headers["transfer-encoding"] = "chunked";
          }
          const headersString = Object.keys(headers)
            .map((h) => `${h}: ${headers[h]}`)
            .join("\r\n");
          socket.write(
            `HTTP/1.1 ${status} ${statusText}\r\n${headersString.join("\r\n")}\r\n\r\n`,
          );
          request.logger.onHeadersSent({ status, statusText });
          request.logger.end();
          socket.once("finish", socket.destroy);
          if (body) {
            const bodyMethods = normalizeBodyMethods(body);
            const observable = bodyMethods.asObservable();
            observable.subscribe({
              next: (data) => {
                socket.write(data);
              },
              error: (value) => {
                socket.emit("error", value);
              },
              complete: () => {
                socket.end();
              },
            });
          } else {
            socket.end();
          }
          return;
        }
        const websocket = await new Promise((resolve) => {
          websocketServer.handleUpgrade(nodeRequest, socket, head, resolve);
        });
        request.logger.onHeadersSent({ status, statusText });
        request.logger.end();
        const websocketAbortController = new AbortController();
        websocketClientSet.add(websocket);
        websocket.once("close", () => {
          websocketClientSet.delete(websocket);
          websocketAbortController.abort();
        });
        body = await body;
        if (!body) {
          return;
        }
        const bodyMethods = normalizeBodyMethods(body);
        const observable = bodyMethods.asObservable();
        let subscription = observable.subscribe({
          next: (data) => {
            websocket.send(data);
          },
          error: (value) => {
            websocket.emit("error", value);
          },
          complete: () => {
            // we can explicitely say we are done sending data by putting
            // connection: "close" on response headers
            if (headers["connection"] === "close") {
              websocket.terminate();
            }
          },
        });
        websocket.once("close", () => {
          subscription.unsubscribe();
        });
      };

      // see server-polyglot.js, upgrade must be listened on https server when used
      const facadeServer = nodeServer._tlsServer || nodeServer;
      const removeUpgradeCallback = listenEvent(
        facadeServer,
        "upgrade",
        upgradeEventHandler,
      );
      stopCallbackSet.add(removeUpgradeCallback);
      stopCallbackSet.add(() => {
        for (const websocketClient of websocketClientSet) {
          websocketClient.close();
        }
        websocketClientSet.clear();
        websocketServer.close();
        websocketServer = null;
      });
    }

    const removeRequestListener = listenRequest(
      nodeServer,
      requestEventHandler,
    );
    // ensure we don't try to handle new requests while server is stopping
    stopCallbackSet.add(removeRequestListener);
  }

  if (startLog) {
    if (serverOrigins.network) {
      logger.info(
        `${serverName} started at ${serverOrigins.local} (${serverOrigins.network})`,
      );
    } else {
      logger.info(`${serverName} started at ${serverOrigins.local}`);
    }
  }

  Object.assign(server, {
    getStatus: () => status,
    port,
    hostname,
    origin: serverOrigin,
    origins: serverOrigins,
    nodeServer,
    stop,
    stoppedPromise,
    addEffect: (callback) => {
      const cleanup = callback();
      if (typeof cleanup === "function") {
        stopCallbackSet.add(cleanup);
      }
    },
  });
  return server;
};

const createNodeServer = async ({
  https,
  redirectHttpToHttps,
  allowHttpRequestOnHttps,
  http2,
  http1Allowed,
}) => {
  if (https) {
    const { certificate, privateKey } = https;
    if (redirectHttpToHttps || allowHttpRequestOnHttps) {
      return createPolyglotServer({
        certificate,
        privateKey,
        http2,
        http1Allowed,
      });
    }
    const { createServer } = await import("node:https");
    return createServer({
      cert: certificate,
      key: privateKey,
    });
  }
  const { createServer } = await import("node:http");
  return createServer();
};

const statusTextFromStatus = (status) =>
  http.STATUS_CODES[status] || "not specified";

const testCanPushStream = (http2Stream) => {
  if (!http2Stream.pushAllowed) {
    return {
      can: false,
      reason: `stream.pushAllowed is false`,
    };
  }

  // See https://nodejs.org/dist/latest-v16.x/docs/api/http2.html#http2sessionstate
  // And https://github.com/google/node-h2-auto-push/blob/67a36c04cbbd6da7b066a4e8d361c593d38853a4/src/index.ts#L100-L106
  const { remoteWindowSize } = http2Stream.session.state;
  if (remoteWindowSize === 0) {
    return {
      can: false,
      reason: `no more remoteWindowSize`,
    };
  }

  return {
    can: true,
  };
};

const PROCESS_TEARDOWN_EVENTS_MAP = {
  SIGHUP: STOP_REASON_PROCESS_SIGHUP,
  SIGTERM: STOP_REASON_PROCESS_SIGTERM,
  SIGINT: STOP_REASON_PROCESS_SIGINT,
  beforeExit: STOP_REASON_PROCESS_BEFORE_EXIT,
  exit: STOP_REASON_PROCESS_EXIT,
};

// ESM version of "path-to-regexp@6.2.1"
// https://github.com/pillarjs/path-to-regexp/blob/master/package.json

/**
 * Tokenize input string.
 */
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      let j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          (code >= 48 && code <= 57) ||
          // `A-Z`
          (code >= 65 && code <= 90) ||
          // `a-z`
          (code >= 97 && code <= 122) ||
          // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name) throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError(
              "Capturing groups are not allowed at ".concat(j),
            );
          }
        }
        pattern += str[j++];
      }
      if (count) throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern) throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
/**
 * Parse a string for the raw tokens.
 */
function parse(str, { prefixes = "./", delimiter = "/#?" } = {}) {
  var tokens = lexer(str);

  var defaultPattern = "[^".concat(escapeString(delimiter), "]+?");
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = function (type) {
    if (i < tokens.length && tokens[i].type === type) return tokens[i++].value;
    return undefined;
  };
  var mustConsume = function (type) {
    var value = tryConsume(type);
    if (value !== undefined) return value;
    var _a = tokens[i];
    var nextType = _a.type;
    var index = _a.inde;
    throw new TypeError(
      "Unexpected "
        .concat(nextType, " at ")
        .concat(index, ", expect ")
        .concat(type),
    );
  };
  var consumeText = function () {
    var result = "";
    var value;
    while ((value = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR"))) {
      result += value;
    }
    return result;
  };
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      let prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || defaultPattern,
        modifier: tryConsume("MODIFIER") || "",
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? defaultPattern : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || "",
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
/**
 * Create path match function from `path-to-regexp` spec.
 */
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
/**
 * Create a path match function from `path-to-regexp` output.
 */
function regexpToFunction(re, keys, { decode = (x) => x }) {
  return function (pathname) {
    var m = re.exec(pathname);
    if (!m) return false;
    var path = m[0];
    var index = m.index;
    var params = Object.create(null);
    var _loop_1 = function (i) {
      if (m[i] === undefined) return "continue";
      var key = keys[i - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i]
          .split(key.prefix + key.suffix)
          .map(function (value) {
            return decode(value, key);
          });
      } else {
        params[key.name] = decode(m[i], key);
      }
      return undefined;
    };
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
/**
 * Escape a regular expression string.
 */
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
/**
 * Pull out keys from a regexp.
 */
function regexpToRegexp(path, keys) {
  if (!keys) return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: "",
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
/**
 * Transform an array into a regexp.
 */
function arrayToRegexp(paths, keys, { sensitive }) {
  var parts = paths.map(function (path) {
    return pathToRegexp(path, keys, { sensitive }).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), sensitive ? "" : "i");
}
/**
 * Create a path regexp from string input.
 */
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
/**
 * Expose a function for taking tokens and returning a RegExp.
 */
function tokensToRegexp(
  tokens,
  keys,
  {
    sensitive,
    strict = false,
    start = true,
    end = true,
    encode = (x) => x,
    delimiter = "/#?",
    endsWith = "",
  } = {},
) {
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  // Iterate over the tokens and create our regexp string.
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys) keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:"
              .concat(prefix, "((?:")
              .concat(token.pattern, ")(?:")
              .concat(suffix)
              .concat(prefix, "(?:")
              .concat(token.pattern, "))*)")
              .concat(suffix, ")")
              .concat(mod);
          } else {
            route += "(?:"
              .concat(prefix, "(")
              .concat(token.pattern, ")")
              .concat(suffix, ")")
              .concat(token.modifier);
          }
        } else if (token.modifier === "+" || token.modifier === "*") {
          route += "((?:"
            .concat(token.pattern, ")")
            .concat(token.modifier, ")");
        } else {
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:"
          .concat(prefix)
          .concat(suffix, ")")
          .concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict) route += "".concat(delimiterRe, "?");
    route += endsWith ? "(?=".concat(endsWithRe, ")") : "$";
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited =
      typeof endToken === "string"
        ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1
        : endToken === undefined;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, sensitive ? "" : "i");
}
/**
 * Normalize the given path string, returning a regular expression.
 *
 * An empty array can be passed in for the keys, which will hold the
 * placeholder key descriptions. For example, using `/user/:id`, `keys` will
 * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
 */
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp) return regexpToRegexp(path, keys);
  if (Array.isArray(path)) return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}

const setupRoutes = (routes) => {
  const candidates = Object.keys(routes).map((pathPattern) => {
    const applyPatternMatching = match(pathPattern, {
      decode: decodeURIComponent,
    });
    return {
      applyPatternMatching,
      requestHandler: routes[pathPattern],
    };
  });

  return (request, { pushResponse, redirectRequest }) => {
    let result;
    const found = candidates.find((candidate) => {
      result = candidate.applyPatternMatching(request.pathname);
      return Boolean(result);
    });
    if (found) {
      return found.requestHandler(
        {
          ...request,
          routeParams: result.params,
        },
        { pushResponse, redirectRequest },
      );
    }
    return null;
  };
};

const convertFileSystemErrorToResponseProperties = (error) => {
  // https://iojs.org/api/errors.html#errors_eacces_permission_denied
  if (isErrorWithCode(error, "EACCES")) {
    return {
      status: 403,
      statusText: `EACCES: No permission to read file at ${error.path}`,
    };
  }
  if (isErrorWithCode(error, "EPERM")) {
    return {
      status: 403,
      statusText: `EPERM: No permission to read file at ${error.path}`,
    };
  }
  if (isErrorWithCode(error, "ENOENT")) {
    return {
      status: 404,
      statusText: `ENOENT: File not found at ${error.path}`,
    };
  }
  // file access may be temporarily blocked
  // (by an antivirus scanning it because recently modified for instance)
  if (isErrorWithCode(error, "EBUSY")) {
    return {
      status: 503,
      statusText: `EBUSY: File is busy ${error.path}`,
      headers: {
        "retry-after": 0.01, // retry in 10ms
      },
    };
  }
  // emfile means there is too many files currently opened
  if (isErrorWithCode(error, "EMFILE")) {
    return {
      status: 503,
      statusText: "EMFILE: too many file opened",
      headers: {
        "retry-after": 0.1, // retry in 100ms
      },
    };
  }
  if (isErrorWithCode(error, "EISDIR")) {
    return {
      status: 500,
      statusText: `EISDIR: Unexpected directory operation at ${error.path}`,
    };
  }
  return null;
};

const isErrorWithCode = (error, code) => {
  return typeof error === "object" && error.code === code;
};

const ETAG_FOR_EMPTY_CONTENT = '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';

const bufferToEtag = (buffer) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError(`buffer expect,got ${buffer}`);
  }

  if (buffer.length === 0) {
    return ETAG_FOR_EMPTY_CONTENT;
  }

  const hash = createHash("sha1");
  hash.update(buffer, "utf8");

  const hashBase64String = hash.digest("base64");
  const hashBase64StringSubset = hashBase64String.slice(0, 27);
  const length = buffer.length;

  return `"${length.toString(16)}-${hashBase64StringSubset}"`;
};

const isFileSystemPath = (value) => {
  if (typeof value !== "string") {
    throw new TypeError(
      `isFileSystemPath first arg must be a string, got ${value}`,
    );
  }

  if (value[0] === "/") {
    return true;
  }

  return startsWithWindowsDriveLetter(value);
};

const startsWithWindowsDriveLetter = (string) => {
  const firstChar = string[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;

  const secondChar = string[1];
  if (secondChar !== ":") return false;

  return true;
};

const fileSystemPathToUrl = (value) => {
  if (!isFileSystemPath(value)) {
    throw new Error(`received an invalid value for fileSystemPath: ${value}`);
  }
  return String(pathToFileURL(value));
};

const serveDirectory = (
  url,
  { headers = {}, rootDirectoryUrl } = {},
) => {
  url = String(url);
  url = url[url.length - 1] === "/" ? url : `${url}/`;
  const directoryContentArray = readdirSync(new URL(url));
  const responseProducers = {
    "application/json": () => {
      const directoryContentJson = JSON.stringify(
        directoryContentArray,
        null,
        "  ",
      );
      return {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-length": directoryContentJson.length,
        },
        body: directoryContentJson,
      };
    },
    "text/html": () => {
      const directoryAsHtml = `<!DOCTYPE html>
<html>
  <head>
    <title>Directory explorer</title>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
  </head>

  <body>
    <h1>Content of directory ${url}</h1>
    <ul>
      ${directoryContentArray.map((filename) => {
        const fileUrlObject = new URL(filename, url);
        const fileUrl = String(fileUrlObject);
        let fileUrlRelativeToServer = fileUrl.slice(
          String(rootDirectoryUrl).length,
        );
        if (lstatSync(fileUrlObject).isDirectory()) {
          fileUrlRelativeToServer += "/";
        }
        return `<li>
        <a href="/${fileUrlRelativeToServer}">${fileUrlRelativeToServer}</a>
      </li>`;
      }).join(`
      `)}
    </ul>
  </body>
</html>`;

      return {
        status: 200,
        headers: {
          "content-type": "text/html",
          "content-length": Buffer.byteLength(directoryAsHtml),
        },
        body: directoryAsHtml,
      };
    },
  };
  const bestContentType = pickContentType(
    { headers },
    Object.keys(responseProducers),
  );
  return responseProducers[bestContentType || "application/json"]();
};

/*
 * This function returns response properties in a plain object like
 * { status: 200, body: "Hello world" }.
 * It is meant to be used inside "requestToResponse"
 */


const fetchFileSystem = async (
  filesystemUrl,
  {
    // signal,
    method = "GET",
    headers = {},
    etagEnabled = false,
    etagMemory = true,
    etagMemoryMaxSize = 1000,
    mtimeEnabled = false,
    compressionEnabled = false,
    compressionSizeThreshold = 1024,
    cacheControl = etagEnabled || mtimeEnabled
      ? "private,max-age=0,must-revalidate"
      : "no-store",
    canReadDirectory = false,
    rootDirectoryUrl, //  = `${pathToFileURL(process.cwd())}/`,
    ENOENTFallback = () => {},
  } = {},
) => {
  const urlString = asUrlString(filesystemUrl);
  if (!urlString) {
    return create500Response(
      `fetchFileSystem first parameter must be a file url, got ${filesystemUrl}`,
    );
  }
  if (!urlString.startsWith("file://")) {
    return create500Response(
      `fetchFileSystem url must use "file://" scheme, got ${filesystemUrl}`,
    );
  }
  if (rootDirectoryUrl) {
    let rootDirectoryUrlString = asUrlString(rootDirectoryUrl);
    if (!rootDirectoryUrlString) {
      return create500Response(
        `rootDirectoryUrl must be a string or an url, got ${rootDirectoryUrl}`,
      );
    }
    if (!rootDirectoryUrlString.endsWith("/")) {
      rootDirectoryUrlString = `${rootDirectoryUrlString}/`;
    }
    if (!urlString.startsWith(rootDirectoryUrlString)) {
      return create500Response(
        `fetchFileSystem url must be inside root directory, got ${urlString}`,
      );
    }
    rootDirectoryUrl = rootDirectoryUrlString;
  }

  // here you might be tempted to add || cacheControl === 'no-cache'
  // but no-cache means resource can be cached but must be revalidated (yeah naming is strange)
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#Cacheability
  if (cacheControl === "no-store") {
    if (etagEnabled) {
      console.warn(`cannot enable etag when cache-control is ${cacheControl}`);
      etagEnabled = false;
    }
    if (mtimeEnabled) {
      console.warn(`cannot enable mtime when cache-control is ${cacheControl}`);
      mtimeEnabled = false;
    }
  }
  if (etagEnabled && mtimeEnabled) {
    console.warn(
      `cannot enable both etag and mtime, mtime disabled in favor of etag.`,
    );
    mtimeEnabled = false;
  }

  if (method !== "GET" && method !== "HEAD") {
    return {
      status: 501,
    };
  }

  const serveFile = async (fileUrl) => {
    try {
      const [readStatTiming, fileStat] = timeFunction(
        "file service>read file stat",
        () => statSync(new URL(fileUrl)),
      );
      if (fileStat.isDirectory()) {
        if (canReadDirectory) {
          return serveDirectory(fileUrl, {
            headers,
            canReadDirectory,
            rootDirectoryUrl,
          });
        }
        return {
          status: 403,
          statusText: "not allowed to read directory",
        };
      }
      // not a file, give up
      if (!fileStat.isFile()) {
        return {
          status: 404,
          timing: readStatTiming,
        };
      }

      const clientCacheResponse = await getClientCacheResponse({
        headers,
        etagEnabled,
        etagMemory,
        etagMemoryMaxSize,
        mtimeEnabled,
        fileStat,
        fileUrl,
      });

      // send 304 (redirect response to client cache)
      // because the response body does not have to be transmitted
      if (clientCacheResponse.status === 304) {
        return composeTwoResponses(
          {
            timing: readStatTiming,
            headers: {
              ...(cacheControl ? { "cache-control": cacheControl } : {}),
            },
          },
          clientCacheResponse,
        );
      }

      let response;
      if (compressionEnabled && fileStat.size >= compressionSizeThreshold) {
        const compressedResponse = await getCompressedResponse({
          headers,
          fileUrl,
        });
        if (compressedResponse) {
          response = compressedResponse;
        }
      }
      if (!response) {
        response = await getRawResponse({
          fileStat,
          fileUrl,
        });
      }

      const intermediateResponse = composeTwoResponses(
        {
          timing: readStatTiming,
          headers: {
            ...(cacheControl ? { "cache-control": cacheControl } : {}),
            // even if client cache is disabled, server can still
            // send his own cache control but client should just ignore it
            // and keep sending cache-control: 'no-store'
            // if not, uncomment the line below to preserve client
            // desire to ignore cache
            // ...(headers["cache-control"] === "no-store" ? { "cache-control": "no-store" } : {}),
          },
        },
        response,
      );
      return composeTwoResponses(intermediateResponse, clientCacheResponse);
    } catch (e) {
      if (e.code === "ENOENT") {
        const fallbackFileUrl = ENOENTFallback();
        if (fallbackFileUrl) {
          return serveFile(fallbackFileUrl);
        }
      }
      return composeTwoResponses(
        {
          headers: {
            ...(cacheControl ? { "cache-control": cacheControl } : {}),
          },
        },
        convertFileSystemErrorToResponseProperties(e) || {},
      );
    }
  };

  return serveFile(`file://${new URL(urlString).pathname}`);
};

const create500Response = (message) => {
  return {
    status: 500,
    headers: {
      "content-type": "text/plain",
      "content-length": Buffer.byteLength(message),
    },
    body: message,
  };
};

const getClientCacheResponse = async ({
  headers,
  etagEnabled,
  etagMemory,
  etagMemoryMaxSize,
  mtimeEnabled,
  fileStat,
  fileUrl,
}) => {
  // here you might be tempted to add || headers["cache-control"] === "no-cache"
  // but no-cache means resource can be cache but must be revalidated (yeah naming is strange)
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#Cacheability

  if (
    headers["cache-control"] === "no-store" ||
    // let's disable it on no-cache too
    headers["cache-control"] === "no-cache"
  ) {
    return { status: 200 };
  }

  if (etagEnabled) {
    return getEtagResponse({
      headers,
      etagMemory,
      etagMemoryMaxSize,
      fileStat,
      fileUrl,
    });
  }

  if (mtimeEnabled) {
    return getMtimeResponse({
      headers,
      fileStat,
    });
  }

  return { status: 200 };
};

const getEtagResponse = async ({
  headers,
  etagMemory,
  etagMemoryMaxSize,
  fileUrl,
  fileStat,
}) => {
  const [computeEtagTiming, fileContentEtag] = await timeFunction(
    "file service>generate file etag",
    () =>
      computeEtag({
        etagMemory,
        etagMemoryMaxSize,
        fileUrl,
        fileStat,
      }),
  );

  const requestHasIfNoneMatchHeader = "if-none-match" in headers;
  if (
    requestHasIfNoneMatchHeader &&
    headers["if-none-match"] === fileContentEtag
  ) {
    return {
      status: 304,
      timing: computeEtagTiming,
    };
  }

  return {
    status: 200,
    headers: {
      etag: fileContentEtag,
    },
    timing: computeEtagTiming,
  };
};

const ETAG_MEMORY_MAP = new Map();
const computeEtag = async ({
  etagMemory,
  etagMemoryMaxSize,
  fileUrl,
  fileStat,
}) => {
  if (etagMemory) {
    const etagMemoryEntry = ETAG_MEMORY_MAP.get(fileUrl);
    if (
      etagMemoryEntry &&
      fileStatAreTheSame(etagMemoryEntry.fileStat, fileStat)
    ) {
      return etagMemoryEntry.eTag;
    }
  }
  const fileContentAsBuffer = await new Promise((resolve, reject) => {
    readFile(new URL(fileUrl), (error, buffer) => {
      if (error) {
        reject(error);
      } else {
        resolve(buffer);
      }
    });
  });
  const eTag = bufferToEtag(fileContentAsBuffer);
  if (etagMemory) {
    if (ETAG_MEMORY_MAP.size >= etagMemoryMaxSize) {
      const firstKey = Array.from(ETAG_MEMORY_MAP.keys())[0];
      ETAG_MEMORY_MAP.delete(firstKey);
    }
    ETAG_MEMORY_MAP.set(fileUrl, { fileStat, eTag });
  }
  return eTag;
};

// https://nodejs.org/api/fs.html#fs_class_fs_stats
const fileStatAreTheSame = (leftFileStat, rightFileStat) => {
  return fileStatKeysToCompare.every((keyToCompare) => {
    const leftValue = leftFileStat[keyToCompare];
    const rightValue = rightFileStat[keyToCompare];
    return leftValue === rightValue;
  });
};
const fileStatKeysToCompare = [
  // mtime the the most likely to change, check it first
  "mtimeMs",
  "size",
  "ctimeMs",
  "ino",
  "mode",
  "uid",
  "gid",
  "blksize",
];

const getMtimeResponse = async ({ headers, fileStat }) => {
  if ("if-modified-since" in headers) {
    let cachedModificationDate;
    try {
      cachedModificationDate = new Date(headers["if-modified-since"]);
    } catch {
      return {
        status: 400,
        statusText: "if-modified-since header is not a valid date",
      };
    }

    const actualModificationDate = dateToSecondsPrecision(fileStat.mtime);
    if (Number(cachedModificationDate) >= Number(actualModificationDate)) {
      return {
        status: 304,
      };
    }
  }

  return {
    status: 200,
    headers: {
      "last-modified": dateToUTCString(fileStat.mtime),
    },
  };
};

const getCompressedResponse = async ({ fileUrl, headers }) => {
  const contentType = CONTENT_TYPE.fromUrlExtension(fileUrl);
  if (CONTENT_TYPE.isBinary(contentType)) {
    return null;
  }
  const acceptedCompressionFormat = pickContentEncoding(
    { headers },
    Object.keys(availableCompressionFormats),
  );
  if (!acceptedCompressionFormat) {
    return null;
  }

  const fileReadableStream = fileUrlToReadableStream(fileUrl);
  const body =
    await availableCompressionFormats[acceptedCompressionFormat](
      fileReadableStream,
    );

  return {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-encoding": acceptedCompressionFormat,
      "vary": "accept-encoding",
    },
    body,
  };
};

const fileUrlToReadableStream = (fileUrl) => {
  return createReadStream(new URL(fileUrl), {
    emitClose: true,
    autoClose: true,
  });
};

const availableCompressionFormats = {
  br: async (fileReadableStream) => {
    const { createBrotliCompress } = await import("node:zlib");
    return fileReadableStream.pipe(createBrotliCompress());
  },
  deflate: async (fileReadableStream) => {
    const { createDeflate } = await import("node:zlib");
    return fileReadableStream.pipe(createDeflate());
  },
  gzip: async (fileReadableStream) => {
    const { createGzip } = await import("node:zlib");
    return fileReadableStream.pipe(createGzip());
  },
};

const getRawResponse = async ({ fileUrl, fileStat }) => {
  return {
    status: 200,
    headers: {
      "content-type": CONTENT_TYPE.fromUrlExtension(fileUrl),
      "content-length": fileStat.size,
    },
    body: fileUrlToReadableStream(fileUrl),
  };
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toUTCString
const dateToUTCString = (date) => date.toUTCString();

const dateToSecondsPrecision = (date) => {
  const dateWithSecondsPrecision = new Date(date);
  dateWithSecondsPrecision.setMilliseconds(0);
  return dateWithSecondsPrecision;
};

const asUrlString = (value) => {
  if (value instanceof URL) {
    return value.href;
  }
  if (typeof value === "string") {
    if (isFileSystemPath(value)) {
      return fileSystemPathToUrl(value);
    }
    try {
      const urlObject = new URL(value);
      return String(urlObject);
    } catch {
      return null;
    }
  }
  return null;
};

const jsenvServiceErrorHandler = ({ sendErrorDetails = false } = {}) => {
  return {
    name: "jsenv:error_handler",
    handleError: (serverInternalError, { request }) => {
      const serverInternalErrorIsAPrimitive =
        serverInternalError === null ||
        (typeof serverInternalError !== "object" &&
          typeof serverInternalError !== "function");
      if (!serverInternalErrorIsAPrimitive && serverInternalError.asResponse) {
        return serverInternalError.asResponse();
      }
      const dataToSend = serverInternalErrorIsAPrimitive
        ? {
            code: "VALUE_THROWED",
            value: serverInternalError,
          }
        : {
            code: serverInternalError.code || "UNKNOWN_ERROR",
            ...(sendErrorDetails
              ? {
                  stack: serverInternalError.stack,
                  ...serverInternalError,
                }
              : {}),
          };

      const availableContentTypes = {
        "text/html": () => {
          const renderHtmlForErrorWithoutDetails = () => {
            return `<p>Details not available: to enable them use jsenvServiceErrorHandler({ sendErrorDetails: true }).</p>`;
          };

          const renderHtmlForErrorWithDetails = () => {
            if (serverInternalErrorIsAPrimitive) {
              return `<pre>${JSON.stringify(
                serverInternalError,
                null,
                "  ",
              )}</pre>`;
            }
            return `<pre>${serverInternalError.stack}</pre>`;
          };

          const body = `<!DOCTYPE html>
<html>
  <head>
    <title>Internal server error</title>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
  </head>

  <body>
    <h1>Internal server error</h1>
    <p>${
      serverInternalErrorIsAPrimitive
        ? `Code inside server has thrown a literal.`
        : `Code inside server has thrown an error.`
    }</p>
    <details>
      <summary>See internal error details</summary>
      ${
        sendErrorDetails
          ? renderHtmlForErrorWithDetails()
          : renderHtmlForErrorWithoutDetails()
      }
    </details>
  </body>
</html>`;

          return {
            headers: {
              "content-type": "text/html",
              "content-length": Buffer.byteLength(body),
            },
            body,
          };
        },
        "application/json": () => {
          const body = JSON.stringify(dataToSend);
          return {
            headers: {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(body),
            },
            body,
          };
        },
      };
      const bestContentType = pickContentType(
        request,
        Object.keys(availableContentTypes),
      );
      return availableContentTypes[bestContentType || "application/json"]();
    },
  };
};

const jsenvAccessControlAllowedHeaders = ["x-requested-with"];

const jsenvAccessControlAllowedMethods = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "OPTIONS",
];

const jsenvServiceCORS = ({
  accessControlAllowedOrigins = [],
  accessControlAllowedMethods = jsenvAccessControlAllowedMethods,
  accessControlAllowedHeaders = jsenvAccessControlAllowedHeaders,
  accessControlAllowRequestOrigin = false,
  accessControlAllowRequestMethod = false,
  accessControlAllowRequestHeaders = false,
  accessControlAllowCredentials = false,
  // by default OPTIONS request can be cache for a long time, it's not going to change soon ?
  // we could put a lot here, see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
  accessControlMaxAge = 600,
  timingAllowOrigin = false,
} = {}) => {
  // TODO: we should check access control params and throw/warn if we find strange values

  const corsEnabled =
    accessControlAllowRequestOrigin || accessControlAllowedOrigins.length;

  if (!corsEnabled) {
    return [];
  }

  return {
    name: "jsenv:cors",
    injectResponseHeaders: (response, { request }) => {
      const accessControlHeaders = generateAccessControlHeaders({
        request,
        accessControlAllowedOrigins,
        accessControlAllowRequestOrigin,
        accessControlAllowedMethods,
        accessControlAllowRequestMethod,
        accessControlAllowedHeaders,
        accessControlAllowRequestHeaders,
        accessControlAllowCredentials,
        accessControlMaxAge,
        timingAllowOrigin,
      });
      return accessControlHeaders;
    },
  };
};

// https://www.w3.org/TR/cors/
// https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
const generateAccessControlHeaders = ({
  request: { headers },
  accessControlAllowedOrigins,
  accessControlAllowRequestOrigin,
  accessControlAllowedMethods,
  accessControlAllowRequestMethod,
  accessControlAllowedHeaders,
  accessControlAllowRequestHeaders,
  accessControlAllowCredentials,
  // by default OPTIONS request can be cache for a long time, it's not going to change soon ?
  // we could put a lot here, see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
  accessControlMaxAge = 600,
  timingAllowOrigin,
} = {}) => {
  const vary = [];

  const allowedOriginArray = [...accessControlAllowedOrigins];
  if (accessControlAllowRequestOrigin) {
    if ("origin" in headers && headers.origin !== "null") {
      allowedOriginArray.push(headers.origin);
      vary.push("origin");
    } else if ("referer" in headers) {
      allowedOriginArray.push(new URL(headers.referer).origin);
      vary.push("referer");
    } else {
      allowedOriginArray.push("*");
    }
  }

  const allowedMethodArray = [...accessControlAllowedMethods];
  if (
    accessControlAllowRequestMethod &&
    "access-control-request-method" in headers
  ) {
    const requestMethodName = headers["access-control-request-method"];
    if (!allowedMethodArray.includes(requestMethodName)) {
      allowedMethodArray.push(requestMethodName);
      vary.push("access-control-request-method");
    }
  }

  const allowedHeaderArray = [...accessControlAllowedHeaders];
  if (
    accessControlAllowRequestHeaders &&
    "access-control-request-headers" in headers
  ) {
    const requestHeaderNameArray =
      headers["access-control-request-headers"].split(", ");
    requestHeaderNameArray.forEach((headerName) => {
      const headerNameLowerCase = headerName.toLowerCase();
      if (!allowedHeaderArray.includes(headerNameLowerCase)) {
        allowedHeaderArray.push(headerNameLowerCase);
        if (!vary.includes("access-control-request-headers")) {
          vary.push("access-control-request-headers");
        }
      }
    });
  }

  return {
    "access-control-allow-origin": allowedOriginArray.join(", "),
    "access-control-allow-methods": allowedMethodArray.join(", "),
    "access-control-allow-headers": allowedHeaderArray.join(", "),
    ...(accessControlAllowCredentials
      ? { "access-control-allow-credentials": true }
      : {}),
    "access-control-max-age": accessControlMaxAge,
    ...(timingAllowOrigin
      ? { "timing-allow-origin": allowedOriginArray.join(", ") }
      : {}),
    ...(vary.length ? { vary: vary.join(", ") } : {}),
  };
};

// https://www.html5rocks.com/en/tutorials/eventsource/basics/
const createSSERoom = ({
  logLevel,
  effect = () => {},
  // do not keep process alive because of rooms, something else must keep it alive
  keepProcessAlive = false,
  keepaliveDuration = 30 * 1000,
  retryDuration = 1 * 1000,
  historyLength = 1 * 1000,
  maxClientAllowed = 100, // max 100 clients accepted
  computeEventId = (event, lastEventId) => lastEventId + 1,
  welcomeEventEnabled = false,
  welcomeEventPublic = false, // decides if welcome event are sent to other clients
} = {}) => {
  const logger = createLogger({ logLevel });

  const room = {};
  const clients = new Set();
  const eventHistory = createEventHistory(historyLength);
  // what about previousEventId that keeps growing ?
  // we could add some limit
  // one limit could be that an event older than 24h is deleted
  let previousEventId = 0;
  let opened = false;
  let interval;
  let cleanupEffect = CLEANUP_NOOP;

  const join = (request) => {
    // should we ensure a given request can join a room only once?

    const lastKnownId =
      request.headers["last-event-id"] ||
      new URL(request.url).searchParams.get("last-event-id");

    if (clients.size >= maxClientAllowed) {
      return {
        status: 503,
      };
    }

    if (!opened) {
      return {
        status: 204,
      };
    }

    const sseRoomObservable = createObservable(({ next, complete }) => {
      const client = {
        next,
        complete,
        request,
      };
      if (clients.size === 0) {
        const effectReturnValue = effect();
        if (typeof effectReturnValue === "function") {
          cleanupEffect = effectReturnValue;
        } else {
          cleanupEffect = CLEANUP_NOOP;
        }
      }
      clients.add(client);
      logger.debug(
        `A client has joined. Number of client in room: ${clients.size}`,
      );

      if (lastKnownId !== undefined) {
        const previousEvents = getAllEventSince(lastKnownId);
        const eventMissedCount = previousEvents.length;
        if (eventMissedCount > 0) {
          logger.info(
            `send ${eventMissedCount} event missed by client since event with id "${lastKnownId}"`,
          );
          previousEvents.forEach((previousEvent) => {
            next(stringifySourceEvent(previousEvent));
          });
        }
      }

      if (welcomeEventEnabled) {
        const welcomeEvent = {
          retry: retryDuration,
          type: "welcome",
          data: new Date().toLocaleTimeString(),
        };
        addEventToHistory(welcomeEvent);

        // send to everyone
        if (welcomeEventPublic) {
          sendEventToAllClients(welcomeEvent, {
            history: false,
          });
        }
        // send only to this client
        else {
          next(stringifySourceEvent(welcomeEvent));
        }
      } else {
        const firstEvent = {
          retry: retryDuration,
          type: "comment",
          data: new Date().toLocaleTimeString(),
        };
        next(stringifySourceEvent(firstEvent));
      }

      return () => {
        clients.delete(client);
        if (clients.size === 0) {
          cleanupEffect();
          cleanupEffect = CLEANUP_NOOP;
        }
        logger.debug(
          `A client left. Number of client in room: ${clients.size}`,
        );
      };
    });

    const requestSSEObservable = connectRequestAndRoom(
      request,
      room,
      sseRoomObservable,
    );

    return {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
        "connection": "keep-alive",
      },
      body: requestSSEObservable,
    };
  };

  const leave = (request) => {
    disconnectRequestFromRoom(request, room);
  };

  const addEventToHistory = (event) => {
    if (typeof event.id === "undefined") {
      event.id = computeEventId(event, previousEventId);
    }
    previousEventId = event.id;
    eventHistory.add(event);
  };

  const sendEventToAllClients = (event, { history = true } = {}) => {
    if (history) {
      addEventToHistory(event);
    }
    logger.debug(
      `send "${event.type}" event to ${clients.size} client in the room`,
    );
    const eventString = stringifySourceEvent(event);
    clients.forEach((client) => {
      client.next(eventString);
    });
  };

  const getAllEventSince = (id) => {
    const events = eventHistory.since(id);
    if (welcomeEventEnabled && !welcomeEventPublic) {
      return events.filter((event) => event.type !== "welcome");
    }
    return events;
  };

  const keepAlive = () => {
    // maybe that, when an event occurs, we can delay the keep alive event
    logger.debug(
      `send keep alive event, number of client listening event source: ${clients.size}`,
    );
    sendEventToAllClients(
      {
        type: "comment",
        data: new Date().toLocaleTimeString(),
      },
      { history: false },
    );
  };

  const open = () => {
    if (opened) return;
    opened = true;
    interval = setInterval(keepAlive, keepaliveDuration);
    if (!keepProcessAlive) {
      interval.unref();
    }
  };

  const close = () => {
    if (!opened) return;
    logger.debug(`closing room, number of client in the room: ${clients.size}`);
    clients.forEach((client) => client.complete());
    clients.clear();
    clearInterval(interval);
    eventHistory.reset();
    opened = false;
  };

  open();

  Object.assign(room, {
    // main api:
    // - ability to sendEvent to clients in the room
    // - ability to join the room
    // - ability to leave the room
    sendEventToAllClients,
    join,
    leave,

    // should rarely be necessary, get information about the room
    getAllEventSince,
    getRoomClientCount: () => clients.size,

    // should rarely be used
    close,
    open,
  });
  return room;
};

const CLEANUP_NOOP = () => {};

const requestMap = new Map();

const connectRequestAndRoom = (request, room, roomObservable) => {
  let sseProducer;
  let roomObservableMap;
  const requestInfo = requestMap.get(request);
  if (requestInfo) {
    sseProducer = requestInfo.sseProducer;
    roomObservableMap = requestInfo.roomObservableMap;
  } else {
    sseProducer = createCompositeProducer({
      cleanup: () => {
        requestMap.delete(request);
      },
    });
    roomObservableMap = new Map();
    requestMap.set(request, { sseProducer, roomObservableMap });
  }

  roomObservableMap.set(room, roomObservable);
  sseProducer.addObservable(roomObservable);

  return createObservable(sseProducer);
};

const disconnectRequestFromRoom = (request, room) => {
  const requestInfo = requestMap.get(request);
  if (!requestInfo) {
    return;
  }
  const { sseProducer, roomObservableMap } = requestInfo;
  const roomObservable = roomObservableMap.get(room);
  roomObservableMap.delete(room);
  sseProducer.removeObservable(roomObservable);
};

// https://github.com/dmail-old/project/commit/da7d2c88fc8273850812972885d030a22f9d7448
// https://github.com/dmail-old/project/commit/98b3ae6748d461ac4bd9c48944a551b1128f4459
// https://github.com/dmail-old/http-eventsource/blob/master/lib/event-source.js
// http://html5doctor.com/server-sent-events/
const stringifySourceEvent = ({ data, type = "message", id, retry }) => {
  let string = "";

  if (id !== undefined) {
    string += `id:${id}\n`;
  }

  if (retry) {
    string += `retry:${retry}\n`;
  }

  if (type !== "message") {
    string += `event:${type}\n`;
  }

  string += `data:${data}\n\n`;

  return string;
};

const createEventHistory = (limit) => {
  const events = [];

  const add = (data) => {
    events.push(data);

    if (events.length >= limit) {
      events.shift();
    }
  };

  const since = (id) => {
    const index = events.findIndex((event) => String(event.id) === id);
    return index === -1 ? [] : events.slice(index + 1);
  };

  const reset = () => {
    events.length = 0;
  };

  return { add, since, reset };
};

const jsenvServiceResponseAcceptanceCheck = () => {
  return {
    name: "jsenv:response_acceptance_check",
    inspectResponse: (request, { response, warn }) => {
      checkResponseAcceptance(request, response, { warn });
    },
  };
};

const checkResponseAcceptance = (request, response, { warn }) => {
  const requestAcceptHeader = request.headers.accept;
  const responseContentTypeHeader = response.headers["content-type"];
  if (
    requestAcceptHeader &&
    responseContentTypeHeader &&
    !pickContentType(request, [responseContentTypeHeader])
  ) {
    warn(`response content type is not in the request accepted content types.
--- response content-type header ---
${responseContentTypeHeader}
--- request accept header ---
${requestAcceptHeader}`);
  }

  const requestAcceptLanguageHeader = request.headers["accept-language"];
  const responseContentLanguageHeader = response.headers["content-language"];
  if (
    requestAcceptLanguageHeader &&
    responseContentLanguageHeader &&
    !pickContentLanguage(request, [responseContentLanguageHeader])
  ) {
    warn(`response language is not in the request accepted language.
--- response content-language header ---
${responseContentLanguageHeader}
--- request accept-language header ---
${requestAcceptLanguageHeader}`);
  }

  const requestAcceptEncodingHeader = request.headers["accept-encoding"];
  const responseContentEncodingHeader = response.headers["content-encoding"];
  if (
    requestAcceptLanguageHeader &&
    responseContentLanguageHeader &&
    !pickContentEncoding(request, [responseContentLanguageHeader])
  ) {
    warn(`response encoding is not in the request accepted encoding.
--- response content-encoding header ---
${responseContentEncodingHeader}
--- request accept-encoding header ---
${requestAcceptEncodingHeader}`);
  }
};

const fromFetchResponse = (fetchResponse) => {
  const responseHeaders = {};
  const headersToIgnore = ["connection"];
  fetchResponse.headers.forEach((value, name) => {
    if (!headersToIgnore.includes(name)) {
      responseHeaders[name] = value;
    }
  });
  return {
    status: fetchResponse.status,
    statusText: fetchResponse.statusText,
    headers: responseHeaders,
    body: fetchResponse.body, // node-fetch assumed
  };
};

const jsenvServiceRequestAliases = (resourceAliases) => {
  const aliases = {};
  Object.keys(resourceAliases).forEach((key) => {
    aliases[asFileUrl(key)] = asFileUrl(resourceAliases[key]);
  });
  return {
    name: "jsenv:request_aliases",
    redirectRequest: (request) => {
      const resourceBeforeAlias = request.resource;
      const urlAfterAliasing = URL_META.applyAliases({
        url: asFileUrl(request.pathname),
        aliases,
      });
      const resourceAfterAlias = urlAfterAliasing.slice("file://".length);
      if (resourceBeforeAlias === resourceAfterAlias) {
        return null;
      }
      const resource = replaceResource(resourceBeforeAlias, resourceAfterAlias);
      return { resource };
    },
  };
};

const asFileUrl = (specifier) => new URL(specifier, "file:///").href;

const replaceResource = (resourceBeforeAlias, newValue) => {
  const urlObject = new URL(resourceBeforeAlias, "file:///");
  const searchSeparatorIndex = newValue.indexOf("?");
  if (searchSeparatorIndex > -1) {
    return newValue; // let new value override search params
  }
  urlObject.pathname = newValue;
  const resource = `${urlObject.pathname}${urlObject.search}`;
  return resource;
};

export { STOP_REASON_INTERNAL_ERROR, STOP_REASON_NOT_SPECIFIED, STOP_REASON_PROCESS_BEFORE_EXIT, STOP_REASON_PROCESS_EXIT, STOP_REASON_PROCESS_SIGHUP, STOP_REASON_PROCESS_SIGINT, STOP_REASON_PROCESS_SIGTERM, composeTwoResponses, createSSERoom, fetchFileSystem, findFreePort, fromFetchResponse, jsenvAccessControlAllowedHeaders, jsenvAccessControlAllowedMethods, jsenvServiceCORS, jsenvServiceErrorHandler, jsenvServiceRequestAliases, jsenvServiceResponseAcceptanceCheck, pickContentEncoding, pickContentLanguage, pickContentType, serveDirectory, setupRoutes, startServer, timeFunction, timeStart };
