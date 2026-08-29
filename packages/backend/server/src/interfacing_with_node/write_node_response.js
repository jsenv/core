import { raceCallbacks } from "@jsenv/abort";
import http from "node:http";
import { Http2ServerResponse } from "node:http2";
import { Socket } from "node:net";
import { asReasonPhrase } from "../internal/reason_phrase.js";
import { getObservableValueType } from "./get_observable_value_type.js";
import { observableFromValue } from "./observable_from.js";

export const writeNodeResponse = async (
  responseStream,
  { status, statusText, headers, body },
  { signal, ignoreBody, onAbort, onError, onHeadersSent, onEnd } = {},
) => {
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

  await new Promise((resolve) => {
    const abortController = new AbortController();
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

    // a string or a buffer is written and ended in one go
    if (typeof body === "string" || body instanceof Uint8Array) {
      responseStream.end(body);
      return;
    }

    const observable = observableFromValue(body);
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
  });
};

const writeHead = (
  responseStream,
  { status, statusText, headers, onHeadersSent },
) => {
  const responseIsNetSocket = responseStream instanceof Socket;
  const responseIsHttp2ServerResponse =
    responseStream instanceof Http2ServerResponse;
  const nodeHeaders = headersToNodeHeaders(headers, {
    // https://github.com/nodejs/node/blob/79296dc2d02c0b9872bbfcbb89148ea036a546d0/lib/internal/http2/compat.js#L112
    ignoreConnectionHeader: responseIsHttp2ServerResponse,
  });
  statusText =
    statusText === undefined
      ? statusTextFromStatus(status)
      : asReasonPhrase(statusText);
  if (responseIsHttp2ServerResponse) {
    // http2 has no reason phrase: statusText only reaches the logs
    responseStream.writeHead(status, nodeHeaders);
    onHeadersSent({ nodeHeaders, status, statusText });
    return;
  }
  if (responseIsNetSocket) {
    // a websocket upgrade request answered with something else than 101:
    // the response is written by hand on the socket
    const headersString = Object.keys(nodeHeaders)
      .map((h) => `${h}: ${nodeHeaders[h]}`)
      .join("\r\n");
    responseStream.write(
      `HTTP/1.1 ${status} ${statusText}\r\n${headersString}\r\n\r\n`,
    );
    onHeadersSent({ nodeHeaders, status, statusText });
    return;
  }
  responseStream.writeHead(status, statusText, nodeHeaders);
  onHeadersSent({ nodeHeaders, status, statusText });
};

const statusTextFromStatus = (status) =>
  http.STATUS_CODES[status] || "not specified";

const headersToNodeHeaders = (headers, { ignoreConnectionHeader }) => {
  const nodeHeaders = {};
  for (const name of Object.keys(headers)) {
    if (name === "connection" && ignoreConnectionHeader) {
      continue;
    }
    nodeHeaders[name] = headers[name];
  }
  return nodeHeaders;
};
