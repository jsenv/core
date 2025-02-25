import { Abort, raceProcessTeardownEvents } from "@jsenv/abort";
import { createDetailedMessage, createLogger } from "@jsenv/humanize";
import { memoize } from "@jsenv/utils/src/memoize/memoize.js";
import cluster from "node:cluster";
import { isIP } from "node:net";

import {
  applyRedirectionToRequest,
  createPushRequest,
  fromNodeRequest,
} from "./interfacing_with_node/from_node_request.js";
import { writeNodeResponse } from "./interfacing_with_node/write_node_response.js";
import {
  colorizeResponseStatus,
  statusToType,
} from "./internal/colorizeResponseStatus.js";
import { composeTwoHeaders } from "./internal/headers_composition.js";
import { listen, stopListening } from "./internal/listen.js";
import { listenEvent } from "./internal/listenEvent.js";
import { listenRequest } from "./internal/listenRequest.js";
import { listenServerConnectionError } from "./internal/listenServerConnectionError.js";
import { composeTwoResponses } from "./internal/response_composition.js";
import { createPolyglotServer } from "./internal/server-polyglot.js";
import { trackServerPendingConnections } from "./internal/trackServerPendingConnections.js";
import { trackServerPendingRequests } from "./internal/trackServerPendingRequests.js";
import { timingToServerTimingResponseHeaders } from "./server_timing/timing_header.js";
import { createServiceController } from "./service_controller.js";
import {
  STOP_REASON_INTERNAL_ERROR,
  STOP_REASON_NOT_SPECIFIED,
  STOP_REASON_PROCESS_BEFORE_EXIT,
  STOP_REASON_PROCESS_EXIT,
  STOP_REASON_PROCESS_SIGHUP,
  STOP_REASON_PROCESS_SIGINT,
  STOP_REASON_PROCESS_SIGTERM,
} from "./stopReasons.js";

import { applyDnsResolution } from "./internal/dns_resolution.js";
import { parseHostname } from "./internal/hostname_parser.js";
import { createIpGetters } from "./internal/server_ips.js";

export const startServer = async ({
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
  const serviceController = createServiceController(services, {
    routesFromParam: routes,
  });
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
  stop_signal: {
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

  request: {
    const requestCallback = async (nodeRequest, nodeResponse) => {
      // pause the stream to let a chance to "requestToResponse"
      // to call "requestRequestBody". Without this the request body readable stream
      // might be closed when we'll try to attach "data" and "end" listeners to it
      nodeRequest.pause();
      if (!nagle) {
        nodeRequest.connection.setNoDelay(true);
      }
      if (redirectHttpToHttps && !nodeRequest.connection.encrypted) {
        nodeResponse.writeHead(301, {
          location: `${serverOrigin}${nodeRequest.url}`,
        });
        nodeResponse.end();
        return;
      }
      try {
        // eslint-disable-next-line no-new
        new URL(nodeRequest.url, "http://example.com");
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
      });

      // Handling request is asynchronous, we buffer logs for that request
      // until we know what happens with that request
      // It delays logs until we know of the request will be handled
      // but it's mandatory to make logs readable.
      const rootRequestNode = {
        logs: [],
        children: [],
      };
      const addRequestLog = (node, { type, value }) => {
        node.logs.push({ type, value });
      };
      const onRequestHandled = (node) => {
        if (node !== rootRequestNode) {
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
          logger[type](value);
        };
        const visitRequestNodeToLog = (requestNode, depth) => {
          let someLogIsError = false;
          let someLogIsWarn = false;
          requestNode.logs.forEach((log) => {
            if (log.type === "error") {
              someLogIsError = true;
            }
            if (log.type === "warn") {
              someLogIsWarn = true;
            }
          });

          const firstLog = requestNode.logs.shift();
          const lastLog = requestNode.logs.pop();
          const middleLogs = requestNode.logs;

          writeLog(firstLog, { someLogIsError, someLogIsWarn, depth });
          middleLogs.forEach((log) => {
            writeLog(log, { someLogIsError, someLogIsWarn, depth });
          });
          requestNode.children.forEach((child) => {
            visitRequestNodeToLog(child, depth + 1);
          });
          if (lastLog) {
            writeLog(lastLog, {
              someLogIsError,
              someLogIsWarn,
              depth: depth + 1,
            });
          }
        };
        visitRequestNodeToLog(rootRequestNode, 0);
      };
      nodeRequest.on("error", (error) => {
        if (error.message === "aborted") {
          addRequestLog(rootRequestNode, {
            type: "debug",
            value: createDetailedMessage(`request aborted by client`, {
              "error message": error.message,
            }),
          });
        } else {
          // I'm not sure this can happen but it's here in case
          addRequestLog(rootRequestNode, {
            type: "error",
            value: createDetailedMessage(`"error" event emitted on request`, {
              "error stack": error.stack,
            }),
          });
        }
      });

      const pushResponse = async ({ path, method }, { requestNode }) => {
        const http2Stream = nodeResponse.stream;

        // being able to push a stream is nice to have
        // so when it fails it's not critical
        const onPushStreamError = (e) => {
          addRequestLog(requestNode, {
            type: "error",
            value: createDetailedMessage(
              `An error occured while pushing a stream to the response for ${request.resource}`,
              {
                "error stack": e.stack,
              },
            ),
          });
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
          });

          try {
            const responseProperties = await handleRequest(pushRequest, {
              requestNode,
            });
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
                  addRequestLog(requestNode, {
                    type: "debug",
                    value: `Aborting stream to prevent exceeding remoteWindowSize`,
                  });
                  abortController.abort();
                }
              }
            }
            await sendResponse({
              signal: pushResponseOperation.signal,
              request: pushRequest,
              requestNode,
              responseStream: pushStream,
              responseProperties,
            });
          } finally {
            await pushResponseOperation.end();
          }
        });
      };

      const handleRequest = async (request, { requestNode }) => {
        let requestReceivedMeasure;
        if (serverTiming) {
          requestReceivedMeasure = performance.now();
        }
        addRequestLog(requestNode, {
          type: "info",
          value: request.parent
            ? `Push ${request.resource}`
            : `${request.method} ${request.url}`,
        });
        const warn = (value) => {
          addRequestLog(requestNode, {
            type: "warn",
            value,
          });
        };

        let requestWaitingTimeout;
        if (requestWaitingMs) {
          requestWaitingTimeout = setTimeout(
            () => requestWaitingCallback({ request, warn, requestWaitingMs }),
            requestWaitingMs,
          ).unref();
        }

        serviceController.callHooks(
          "redirectRequest",
          request,
          { warn },
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
            warn,
            pushResponse: async ({ path, method }) => {
              if (typeof path !== "string" || path[0] !== "/") {
                addRequestLog(requestNode, {
                  type: "warn",
                  value: `response push ignored because path is invalid (must be a string starting with "/", found ${path})`,
                });
                return;
              }
              if (!request.http2) {
                addRequestLog(requestNode, {
                  type: "warn",
                  value: `response push ignored because request is not http2`,
                });
                return;
              }
              const canPushStream = testCanPushStream(nodeResponse.stream);
              if (!canPushStream.can) {
                addRequestLog(requestNode, {
                  type: "debug",
                  value: `response push ignored because ${canPushStream.reason}`,
                });
                return;
              }

              let preventedByService = null;
              const prevent = () => {
                preventedByService = serviceController.getCurrentService();
              };
              serviceController.callHooksUntil(
                "onResponsePush",
                { path, method },
                {
                  request,
                  warn,
                  prevent,
                },
                () => preventedByService,
              );
              if (preventedByService) {
                addRequestLog(requestNode, {
                  type: "debug",
                  value: `response push prevented by "${preventedByService.name}" service`,
                });
                return;
              }

              const requestChildNode = { logs: [], children: [] };
              requestNode.children.push(requestChildNode);
              await pushResponse(
                { path, method },
                {
                  requestNode: requestChildNode,
                  parentHttp2Stream: nodeResponse.stream,
                },
              );
            },
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
                {
                  request,
                  warn,
                },
              );
            if (!handleErrorReturnValue) {
              throw errorWhileHandlingRequest;
            }
            addRequestLog(requestNode, {
              type: "error",
              value: createDetailedMessage(
                `internal error while handling request`,
                {
                  "error stack": errorWhileHandlingRequest.stack,
                },
              ),
            });
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
          addRequestLog(requestNode, {
            type: "warn",
            value: `content-length header is ${responseProperties.headers["content-length"]} but body is empty`,
          });
        }
        serviceController.callHooks(
          "injectResponseHeaders",
          responseProperties,
          {
            request,
            warn,
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
          warn,
        });
        return responseProperties;
      };

      const sendResponse = async ({
        signal,
        request,
        requestNode,
        responseStream,
        responseProperties,
      }) => {
        // When "pushResponse" is called and the parent response has no body
        // the parent response is immediatly ended. It means child responses (pushed streams)
        // won't get a chance to be pushed.
        // To let a chance to pushed streams we wait a little before sending the response
        const ignoreBody = request.method === "HEAD";
        const bodyIsEmpty = !responseProperties.body || ignoreBody;
        if (bodyIsEmpty && requestNode.children.length > 0) {
          await new Promise((resolve) => setTimeout(resolve));
        }

        await writeNodeResponse(responseStream, responseProperties, {
          signal,
          ignoreBody,
          onAbort: () => {
            addRequestLog(requestNode, {
              type: "info",
              value: `response aborted`,
            });
            onRequestHandled(requestNode);
          },
          onError: (error) => {
            addRequestLog(requestNode, {
              type: "error",
              value: createDetailedMessage(
                `An error occured while sending response`,
                {
                  "error stack": error.stack,
                },
              ),
            });
            onRequestHandled(requestNode);
          },
          onHeadersSent: ({ status, statusText }) => {
            const statusType = statusToType(status);
            addRequestLog(requestNode, {
              type:
                status === 404 && request.pathname === "/favicon.ico"
                  ? "debug"
                  : {
                      information: "info",
                      success: "info",
                      redirection: "info",
                      client_error: "warn",
                      server_error: "error",
                    }[statusType],
              value: `${colorizeResponseStatus(status)} ${
                responseProperties.statusMessage || statusText
              }`,
            });
          },
          onEnd: () => {
            onRequestHandled(requestNode);
          },
        });
      };

      try {
        if (receiveRequestOperation.signal.aborted) {
          return;
        }
        const responseProperties = await handleRequest(request, {
          requestNode: rootRequestNode,
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

        await sendResponse({
          signal: sendResponseOperation.signal,
          request,
          requestNode: rootRequestNode,
          responseStream: nodeResponse,
          responseProperties,
        });
      } finally {
        await sendResponseOperation.end();
      }
    };
    const removeRequestListener = listenRequest(nodeServer, requestCallback);
    // ensure we don't try to handle new requests while server is stopping
    stopCallbackSet.add(removeRequestListener);
  }

  websocket: {
    // https://github.com/websockets/ws/blob/master/doc/ws.md#class-websocket
    const websocketHandlers = [];
    for (const service of serviceController.services) {
      const { handleWebsocket } = service;
      if (handleWebsocket) {
        websocketHandlers.push(handleWebsocket);
      }
    }
    if (websocketHandlers.length > 0) {
      const websocketClients = new Set();
      const { WebSocketServer } = await import("ws");
      let websocketServer = new WebSocketServer({ noServer: true });
      const websocketOrigin = https
        ? `wss://${hostname}:${port}`
        : `ws://${hostname}:${port}`;
      server.websocketOrigin = websocketOrigin;
      const upgradeCallback = (nodeRequest, socket, head) => {
        websocketServer.handleUpgrade(
          nodeRequest,
          socket,
          head,
          async (websocket) => {
            const websocketAbortController = new AbortController();
            websocketClients.add(websocket);
            websocket.signal = websocketAbortController.signal;
            websocket.once("close", () => {
              websocketClients.delete(websocket);
              websocketAbortController.abort();
            });
            const request = fromNodeRequest(nodeRequest, {
              signal: stopAbortSignal,
              serverOrigin: websocketOrigin,
              requestBodyLifetime,
            });
            serviceController.callAsyncHooksUntil(
              "handleWebsocket",
              websocket,
              {
                request,
              },
            );
          },
        );
      };

      // see server-polyglot.js, upgrade must be listened on https server when used
      const facadeServer = nodeServer._tlsServer || nodeServer;
      const removeUpgradeCallback = listenEvent(
        facadeServer,
        "upgrade",
        upgradeCallback,
      );
      stopCallbackSet.add(removeUpgradeCallback);
      stopCallbackSet.add(() => {
        websocketClients.forEach((websocketClient) => {
          websocketClient.close();
        });
        websocketClients.clear();
        websocketServer.close();
        websocketServer = null;
      });
    }
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
