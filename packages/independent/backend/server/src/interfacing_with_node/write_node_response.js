import { raceCallbacks } from "@jsenv/abort";
import http from "node:http";
import { Http2ServerResponse } from "node:http2";
import { Socket } from "node:net";
import { getObservableValueType } from "./get_observable_value_type.js";
import { observableFromValue } from "./observable_from.js";

export const writeNodeResponse = async (
  responseStream,
  { status, statusText, headers, body, bodyEncoding },
  { signal, ignoreBody, onAbort, onError, onHeadersSent, onEnd } = {},
) => {
  const isNetSocket = responseStream instanceof Socket;
  if (
    body &&
    body.isObservableBody &&
    headers["connection"] === undefined &&
    headers["content-length"] === undefined
  ) {
    headers["transfer-encoding"] = "chunked";
  }
  // if (body && headers["content-length"] === undefined) {
  //   headers["transfer-encoding"] = "chunked";
  // }

  const bodyObservableType = getObservableValueType(body);
  const destroyBody = () => {
    if (bodyObservableType === "file_handle") {
      body.close();
      return;
    }
    if (bodyObservableType === "node_stream") {
      body.destroy();
      return;
    }
    if (bodyObservableType === "node_web_stream") {
      body.cancel();
      return;
    }
  };

  if (signal.aborted) {
    destroyBody();
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
    destroyBody();
    responseStream.end();
    return;
  }

  if (bodyEncoding && !isNetSocket) {
    responseStream.setEncoding(bodyEncoding);
  }

  await new Promise((resolve) => {
    const observable = observableFromValue(body);
    const abortController = new AbortController();
    signal.addEventListener("abort", () => {
      abortController.abort();
    });
    observable.subscribe(
      {
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
      },
      { signal: abortController.signal },
    );

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
            abortController.abort();
            responseStream.destroy();
            onAbort();
            resolve();
          },
          error: (error) => {
            abortController.abort();
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
            abortController.abort();
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
  const responseIsNetSocket = responseStream instanceof Socket;
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
    statusText = statusTextFromStatus(status);
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
  if (responseIsNetSocket) {
    const headersString = Object.keys(nodeHeaders)
      .map((h) => `${h}: ${nodeHeaders[h]}`)
      .join("\r\n");
    responseStream.write(
      `HTTP/1.1 ${status} ${statusText}\r\n${headersString}\r\n\r\n`,
    );
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

const statusTextFromStatus = (status) =>
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
