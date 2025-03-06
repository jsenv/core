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
import { websocketSuffixColorized } from "./internal/colorizeResponseStatus.js";
import {
  composeTwoHeaders,
  composeTwoHeaderValues,
} from "./internal/headers_composition.js";
import { listen, stopListening } from "./internal/listen.js";
import { listenEvent } from "./internal/listenEvent.js";
import { listenRequest } from "./internal/listenRequest.js";
import { listenServerConnectionError } from "./internal/listenServerConnectionError.js";
import { composeTwoResponses } from "./internal/response_composition.js";
import { createPolyglotServer } from "./internal/server-polyglot.js";
import { trackServerPendingConnections } from "./internal/trackServerPendingConnections.js";
import { trackServerPendingRequests } from "./internal/trackServerPendingRequests.js";
import { createRouter } from "./router/router.js";
import { timingToServerTimingResponseHeaders } from "./server_timing/timing_header.js";
import {
  createServiceController,
  flattenAndFilterServices,
} from "./service_controller.js";
import { jsenvServiceAutoreloadOnRestart } from "./services/autoreload_on_server_restart/jsenv_service_autoreload_on_server_restart.js";
import { jsenvServiceInternalClientFiles } from "./services/internal_client_files/jsenv_service_internal_client_files.js";
import { jsenvServiceRouteInspector } from "./services/route_inspector/jsenv_service_route_inspector.js";
import {
  STOP_REASON_INTERNAL_ERROR,
  STOP_REASON_NOT_SPECIFIED,
  STOP_REASON_PROCESS_BEFORE_EXIT,
  STOP_REASON_PROCESS_EXIT,
  STOP_REASON_PROCESS_SIGHUP,
  STOP_REASON_PROCESS_SIGINT,
  STOP_REASON_PROCESS_SIGTERM,
} from "./stopReasons.js";
import { getWebSocketHandler } from "./web_socket_response.js";

import { applyDnsResolution } from "./internal/dns_resolution.js";
import { parseHostname } from "./internal/hostname_parser.js";
import { createIpGetters } from "./internal/server_ips.js";

const TIMING_NOOP = () => {
  return { end: () => {} };
};

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

  const allRouteArray = [];
  for (const route of routes) {
    allRouteArray.push(route);
  }
  for (const service of services) {
    const serviceRoutes = service.routes;
    if (serviceRoutes) {
      for (const serviceRoute of serviceRoutes) {
        serviceRoute.service = service;
        allRouteArray.push(serviceRoute);
      }
    }
  }
  const router = createRouter(allRouteArray, {
    optionsFallback: true,
  });

  const server = {};

  services = [
    jsenvServiceRouteInspector(router),
    ...(import.meta.build
      ? // after build internal client files are inlined, no need for this service anymore
        []
      : [jsenvServiceInternalClientFiles()]),
    jsenvServiceAutoreloadOnRestart(),
    ...flattenAndFilterServices(services),
  ];

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
    if (reason !== STOP_REASON_PROCESS_BEFORE_EXIT) {
      logger.info(`${serverName} stopping server (reason: ${reason})`);
    }
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

  const applyRequestInternalRedirection = (request) => {
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
    return request;
  };

  const prepareHandleRequestOperations = (nodeRequest, nodeResponse) => {
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
    return [receiveRequestOperation, sendResponseOperation];
  };
  const getResponseProperties = async (request, { pushResponse }) => {
    const timings = {};
    const timing = serverTiming
      ? (name) => {
          const start = performance.now();
          timings[name] = null;
          return {
            name,
            end: () => {
              const end = performance.now();
              const duration = end - start;
              timings[name] = duration;
            },
          };
        }
      : TIMING_NOOP;
    const startRespondingTiming = timing("time to start responding");

    request.logger.info(
      request.headers["upgrade"] === "websocket"
        ? `GET ${request.url} ${websocketSuffixColorized}`
        : request.parent
          ? `Push ${request.resource}`
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

    let headersToInject;
    const finalizeResponseProperties = (responseProperties) => {
      if (serverTiming) {
        startRespondingTiming.end();
        responseProperties.headers = composeTwoHeaders(
          responseProperties.headers,
          timingToServerTimingResponseHeaders(timings),
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
          `content-length response header found without body`,
        );
      }

      if (headersToInject) {
        responseProperties.headers = composeTwoHeaders(
          responseProperties.headers,
          headersToInject,
        );
      }
      serviceController.callHooks(
        "injectResponseHeaders",
        request,
        responseProperties,
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
      // the node request readable stream is never closed because
      // the response headers contains "connection: keep-alive"
      // In this scenario we want to disable READABLE_STREAM_TIMEOUT warning
      if (
        responseProperties.headers.connection === "keep-alive" &&
        request.body
      ) {
        clearTimeout(request.body.timeout);
      }
      return responseProperties;
    };

    let timeout;
    try {
      request = applyRequestInternalRedirection(request);
      const timeoutResponsePropertiesPromise = new Promise((resolve) => {
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
      const routerResponsePropertiesPromise = (async () => {
        const fetchSecondArg = {
          timing,
          pushResponse,
          injectResponseHeader: (name, value) => {
            if (!headersToInject) {
              headersToInject = {};
            }
            headersToInject[name] = composeTwoHeaderValues(
              name,
              headersToInject[name],
              value,
            );
          },
        };
        serviceController.callHooks(
          "augmentRouteFetchSecondArg",
          request,
          fetchSecondArg,
          (properties) => {
            if (properties) {
              Object.assign(fetchSecondArg, properties);
            }
          },
        );
        const routerResponseProperties = await router.match(
          request,
          fetchSecondArg,
        );
        return routerResponseProperties;
      })();
      const responseProperties = await Promise.race([
        timeoutResponsePropertiesPromise,
        routerResponsePropertiesPromise,
      ]);
      clearTimeout(timeout);
      return finalizeResponseProperties(responseProperties);
    } catch (e) {
      clearTimeout(timeout);
      if (e.name === "AbortError" && request.signal.aborted) {
        // let it propagate to the caller that should catch this
        throw e;
      }
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
        await serviceController.callAsyncHooksUntil("handleError", e, {
          request,
        });
      if (!handleErrorReturnValue) {
        throw e;
      }
      request.logger.error(
        createDetailedMessage(`internal error while handling request`, {
          "error stack": e.stack,
        }),
      );
      const responseProperties = composeTwoResponses(
        {
          status: 500,
          statusText: "Internal Server Error",
          headers: {
            // ensure error are not cached
            "cache-control": "no-store",
          },
        },
        handleErrorReturnValue,
      );
      return finalizeResponseProperties(responseProperties);
    }
  };
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

  request: {
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
        new URL(nodeRequest.url, "http://example.com");
      } catch {
        nodeResponse.writeHead(400, "Request url is not supported");
        nodeResponse.end();
        return;
      }

      const [receiveRequestOperation, sendResponseOperation] =
        prepareHandleRequestOperations(nodeRequest, nodeResponse);
      const request = fromNodeRequest(nodeRequest, {
        signal: stopAbortSignal,
        serverOrigin,
        requestBodyLifetime,
        logger,
        nagle,
      });

      try {
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
        const webSocketHandler = getWebSocketHandler(responseProperties);
        if (webSocketHandler) {
          throw new Error(
            "unexpected websocketResponse received for request that does not want to be upgraded to websocket. A regular response was expected.",
          );
        }
        if (receiveRequestOperation.signal.aborted) {
          return;
        }
        await sendResponse(nodeResponse, responseProperties, {
          signal: sendResponseOperation.signal,
          request,
        });
      } finally {
        await sendResponseOperation.end();
      }
    };
    const removeRequestListener = listenRequest(
      nodeServer,
      requestEventHandler,
    );
    // ensure we don't try to handle new requests while server is stopping
    stopCallbackSet.add(removeRequestListener);
  }

  websocket: {
    // https://github.com/websockets/ws/blob/master/doc/ws.md#class-websocket
    const webSocketOrigin = https
      ? `wss://${hostname}:${port}`
      : `ws://${hostname}:${port}`;
    server.webSocketOrigin = webSocketOrigin;
    const webSocketSet = new Set();
    let upgradeRequestToWebSocketPromise;
    let upgradeRequestToWebSocket;
    const loadUpgradeRequestToWebSocket = async () => {
      if (upgradeRequestToWebSocketPromise) {
        await upgradeRequestToWebSocketPromise;
        return;
      }
      const { WebSocketServer } = await import("ws");
      let webSocketServer = new WebSocketServer({ noServer: true });
      stopCallbackSet.add(() => {
        webSocketServer.close();
        webSocketServer = null;
      });
      upgradeRequestToWebSocket = async ({ nodeRequest, socket, head }) => {
        const websocket = await new Promise((resolve) => {
          webSocketServer.handleUpgrade(nodeRequest, socket, head, resolve);
        });
        return websocket;
      };
    };
    // https://github.com/websockets/ws/blob/b92745a9d6760e6b4b2394bfac78cbcd258a8c8d/lib/websocket-server.js#L491
    const upgradeEventHandler = async (nodeRequest, socket, head) => {
      let request = fromNodeRequest(nodeRequest, {
        signal: stopAbortSignal,
        serverOrigin,
        requestBodyLifetime,
        logger,
        nagle,
      });
      const [receiveRequestOperation, sendResponseOperation] =
        prepareHandleRequestOperations(nodeRequest, socket);
      const responseProperties = await getResponseProperties(request, {
        pushResponse: () => {
          request.logger.warn(
            `pushResponse ignored because it's not supported in websocket`,
          );
        },
      });
      if (receiveRequestOperation.signal.aborted) {
        return;
      }
      if (responseProperties.status !== 101) {
        await sendResponse(socket, responseProperties, {
          signal: sendResponseOperation.signal,
          request,
        });
        return;
      }
      const webSocketHandler = getWebSocketHandler(responseProperties);
      if (!webSocketHandler) {
        throw new Error(
          "unexpected response received for request that wants to be upgraded to websocket. A webSocketResponse was expected.",
        );
      }
      if (!upgradeRequestToWebSocket) {
        await loadUpgradeRequestToWebSocket();
      }
      if (sendResponseOperation.signal.aborted) {
        return;
      }
      const webSocket = await upgradeRequestToWebSocket({
        nodeRequest,
        socket,
        head,
      });
      if (sendResponseOperation.signal.aborted) {
        webSocket.destroy();
        return;
      }
      const webSocketAbortController = new AbortController();
      webSocketSet.add(webSocket);
      webSocket.once("close", () => {
        webSocketSet.delete(webSocket);
        webSocketAbortController.abort();
      });
      request.logger.onHeadersSent({
        status: 101,
        statusText: "Switching Protocols",
      });
      request.logger.end();
      let websocketHandlerReturnValue = await webSocketHandler(webSocket);
      if (typeof websocketHandlerReturnValue === "function") {
        webSocket.once("close", () => {
          websocketHandlerReturnValue();
          websocketHandlerReturnValue = undefined;
        });
      }
      return;
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
      for (const websocket of webSocketSet) {
        websocket.close();
      }
      webSocketSet.clear();
    });
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
