import { Abort, raceProcessTeardownEvents } from "@jsenv/abort";
import { createDetailedMessage, createLogger } from "@jsenv/humanize";
import { memoize } from "@jsenv/utils/src/memoize/memoize.js";
import cluster from "node:cluster";

import {
  applyRedirectionToRequest,
  fromNodeRequest,
} from "./interfacing_with_node/from_node_request.js";
import { writeNodeResponse } from "./interfacing_with_node/write_node_response.js";
import { websocketSuffixColorized } from "./internal/colorize_response_status.js";
import {
  composeTwoHeaders,
  composeTwoHeaderValues,
} from "./internal/headers_composition.js";
import { listen, stopListening } from "./internal/listen.js";
import { listenEvent } from "./internal/listen_event.js";
import { listenRequest } from "./internal/listen_request.js";
import { listenServerConnectionError } from "./internal/listen_server_connection_error.js";
import { composeTwoResponses } from "./internal/response_composition.js";
import { createSecureServer } from "./internal/secure_server.js";
import { resolveServerOrigins } from "./internal/server_origins.js";
import { createPolyglotServer } from "./internal/server_polyglot.js";
import { trackServerPendingConnections } from "./internal/track_server_pending_connections.js";
import { trackServerPendingRequests } from "./internal/track_server_pending_requests.js";
import { serverPluginAutoreloadOnRestart } from "./plugins/autoreload_on_server_restart/server_plugin_autoreload_on_server_restart.js";
import { serverPluginResponseCookies } from "./plugins/cookies/server_plugin_response_cookies.js";
import { serverPluginDefaultBody4xx5xx } from "./plugins/default_body_4xx_5xx/server_plugin_default_body_4xx_5xx.js";
import { serverPluginInternalClientFiles } from "./plugins/internal_client_files/server_plugin_internal_client_files.js";
import { serverPluginOpenFile } from "./plugins/open_file/server_plugin_open_file.js";
import { serverPluginRouteInspector } from "./plugins/route_inspector/server_plugin_route_inspector.js";
import { createServerPluginsController } from "./plugins/server_plugins_controller.js";
import { createPermissionHelpers } from "./router/permissions.js";
import { createRouter } from "./router/router.js";
import { timingToServerTimingResponseHeaders } from "./server_timing/timing_header.js";
import {
  STOP_REASON_INTERNAL_ERROR,
  STOP_REASON_NOT_SPECIFIED,
  STOP_REASON_PROCESS_BEFORE_EXIT,
  STOP_REASON_PROCESS_EXIT,
  STOP_REASON_PROCESS_SIGHUP,
  STOP_REASON_PROCESS_SIGINT,
  STOP_REASON_PROCESS_SIGTERM,
} from "./stop_reasons.js";
import { getWebSocketHandler } from "./web_socket_response.js";

const TIMING_NOOP = () => {
  return { end: () => {} };
};

/**
 * Start an http server (https and http2 optional) answering each request with
 * the first route producing a response.
 *
 * @param {Object} [params={}]
 * @param {Array<Object>} [params.routes=[]] - Route descriptors, tried in order. Each has:
 *   - `endpoint` {string} — Required. `"GET /users/:id"`: an http method (or `*` for any)
 *     and a resource pattern. `:name` captures a segment and `*` a run of segments, both
 *     land in `request.params`; `?page=:page` captures a search param. `"*"` alone
 *     matches everything. An endpoint ending in `.websocket` marks a websocket route.
 *   - `fetch` {Function} — Required. `(request, helpers) => response`, async or not.
 *     Returns a `Response`, a plain `{ status, statusText, statusMessage, headers, body,
 *     timing }` object (`status` defaults to 404, `statusMessage` feeds the body of 4xx/5xx
 *     responses), a `WebSocketResponse`, or `null`/`undefined` to let the next route try.
 *     `request` is described in docs/handling_requests.md. `helpers` holds `timing(name)`,
 *     `injectResponseHeader(name, value)`, `contentNegotiation` (`{ mediaType, language,
 *     version, encoding }` picked from the `available*` lists below), `responseCookies`
 *     (`set`/`delete`), `hasPermissions`, `getAllPermissions`, `router`,
 *     `canExposeSensitiveData`, plus whatever plugins add with "augmentRouteFetchSecondArg".
 *   - `headers` {Object} — Header pattern the request must match
 *     (`{ upgrade: "websocket" }` marks a websocket route).
 *   - `availableMediaTypes`, `availableLanguages`, `availableVersions`, `availableEncodings`
 *     {Array} — What the route can produce, in order of preference. Drives content
 *     negotiation, the `vary` header and 406 responses. Media types are inferred from the
 *     endpoint extension when omitted.
 *   - `acceptedMediaTypes` {Array<string>} — Request body media types accepted by
 *     POST/PATCH/PUT (415 otherwise).
 *   - `permissionsRequired` {Array<string>} — Permissions (granted by "grantPermissions"
 *     plugins) needed to access the route; `[]` opens it to everyone. Once any route
 *     declares permissions, a route without them is hidden (404) from everyone.
 *   - `permissionsToSee` {Array<string>} — Permissions needed to learn the route exists
 *     (403 instead of 404 when access is denied); `[]` makes it visible to everyone.
 *   - `description` {string}, `clientCodeExample` {string|Function}, `declarationSource`
 *     {string} — Shown by the route inspector at `/.internal/route_inspector`.
 *
 * @param {Array<Object>} [params.plugins=[]] - Server plugins, see docs/plugins.md.
 * @param {number} [params.port=0] - `0` lets the OS pick a free port.
 * @param {number} [params.portHint] - With `port: 0`, try this port first, then the next ones.
 * @param {string} [params.hostname="localhost"] - Hostname or ip to listen to; `server.origin` is built from it.
 * @param {boolean} [params.acceptAnyIp=false] - Listen on every interface (`0.0.0.0` or `::`)
 *   so that other machines on the network can reach the server; `server.origins.externalip`
 *   then tells the address to use from there.
 * @param {boolean} [params.preferIpv6] - Favor ipv6 addresses in `server.origins`.
 * @param {Object|false} [params.https=false] - `{ certificate, privateKey }` (PEM strings) to serve https.
 * @param {boolean} [params.redirectHttpToHttps] - With https, answer http requests with a 301
 *   to the https origin. Defaults to true unless `allowHttpRequestOnHttps` is set.
 * @param {boolean} [params.allowHttpRequestOnHttps=false] - With https, also serve plain http
 *   requests on the same port (`request.origin` tells them apart).
 * @param {boolean} [params.http2=false] - Serve http2 (needs `https`, http/1.1 clients are still
 *   accepted). Brings nothing on localhost; a page loading many modules from another machine
 *   loads several times faster. Http2 has no reason phrase: `statusText` then only reaches the
 *   logs and the body of 4xx/5xx responses.
 * @param {boolean} [params.http1Allowed=true] - With http2, still accept http/1.1 clients.
 * @param {string} [params.logLevel] - `"debug"`, `"info"` (default), `"warn"`, `"error"` or `"off"`.
 * @param {string} [params.routerLogLevel] - Same, for the router logs (which route matched).
 * @param {boolean} [params.startLog=true] - Log "server started at …" once listening.
 * @param {string} [params.serverName="server"] - Name used in the logs.
 * @param {AbortSignal} [params.signal] - Cancels the start (an AbortError is thrown). Once
 *   listening the server is stopped with `stop`.
 * @param {boolean} [params.stopOnSIGINT] - Stop on SIGINT (ctrl+c). Defaults to true, except
 *   inside a cluster worker where the primary process is in charge.
 * @param {boolean} [params.stopOnExit=true] - Stop on SIGHUP, SIGTERM, beforeExit and exit.
 * @param {boolean} [params.stopOnInternalError=false] - Stop when a route throws (after the
 *   "handleError" plugins answered).
 * @param {boolean} [params.keepProcessAlive=true] - When false the server alone does not keep
 *   the process alive.
 * @param {boolean} [params.canExposeSensitiveData=false] - Lets the server hand out what
 *   belongs to the machine it runs on. Development only, never in production. It unlocks:
 *   - file paths in status texts (a 404 from `createFileSystemFetch` says which path);
 *   - the declaration source of every route in the route inspector, where every route is
 *     listed whatever its permissions;
 *   - `GET /.internal/open_file/*`, opening a file of the machine in the editor;
 *   - `GET /@jsenv/server/*`, serving this package's own client files;
 *   - `/.internal/alive.websocket` and `/.internal/alive.eventsource`, which a client
 *     subscribes to in order to reload when the server restarts.
 * @param {boolean|Object} [params.serverTiming=false] - `true` or `{ minDuration }` to send
 *   `server-timing` response headers: the time to start responding, the routing of each
 *   plugin, what routes measure with `helpers.timing` and the `timing` a response hands
 *   back. `minDuration` (ms) drops the entries that took less: 0 keeps everything (what a
 *   test wants), a human reading devtools usually wants the sub-millisecond noise gone.
 * @param {number} [params.requestWaitingMs=0] - Call `requestWaitingCallback` when a request
 *   still has no response after that many ms (0 disables).
 * @param {Function} [params.requestWaitingCallback] - `({ request, requestWaitingMs })`, logs a warning by default.
 * @param {number} [params.responseTimeout=600000] - Ms a route can take to start responding
 *   before a 504 is sent instead (10 minutes).
 *
 * @returns {Promise<Object>} The server: `{ origin, origins, port, hostname, nodeServer,
 *   webSocketOrigin, stop, stoppedPromise, getStatus, addEffect }`.
 *   - `origins`: `{ local, localip, externalip }`, `origin` being `origins.local`.
 *   - `stop(reason)`: resolves once every connection is closed; `reason` can be anything
 *     and defaults to `STOP_REASON_NOT_SPECIFIED`.
 *   - `stoppedPromise`: resolves with the reason the server stopped for (one of the
 *     `STOP_REASON_*` exports or what was given to `stop`).
 *   - `getStatus()`: `"starting"`, `"opened"`, `"stopping"` or `"stopped"`.
 *   - `addEffect(callback)`: runs `callback` right away; the function it returns runs
 *     when the server stops.
 */
export const startServer = async ({
  signal = new AbortController().signal,
  logLevel,
  routerLogLevel,
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
  plugins = [],
  canExposeSensitiveData = false,
  serverTiming = false,
  requestWaitingMs = 0,
  requestWaitingCallback = ({ request, requestWaitingMs }) => {
    request.logger.warn(
      createDetailedMessage(
        `still no response found for request after ${requestWaitingMs} ms`,
        {
          "request url": request.url,
          "request headers": JSON.stringify(request.headers, null, "  "),
        },
      ),
    );
  },
  responseTimeout = 60_000 * 10, // 10 minutes
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

  plugins = [
    ...(canExposeSensitiveData ? [serverPluginOpenFile()] : []),
    serverPluginResponseCookies(),
    serverPluginDefaultBody4xx5xx(),
    serverPluginRouteInspector({ canExposeSensitiveData }),
    ...(canExposeSensitiveData ? [serverPluginInternalClientFiles()] : []),
    ...(canExposeSensitiveData ? [serverPluginAutoreloadOnRestart()] : []),
    ...plugins,
  ];

  const serverPluginsController = await createServerPluginsController(plugins);
  const allRouteArray = [];
  for (const route of routes) {
    allRouteArray.push(route);
  }
  for (const serverPlugin of serverPluginsController.activePlugins) {
    const routes = serverPlugin.routes;
    if (routes) {
      for (const route of routes) {
        route.serverPlugin = serverPlugin;
        allRouteArray.push(route);
      }
    }
  }

  const router = createRouter(allRouteArray, {
    optionsFallback: true,
    logLevel: routerLogLevel,
  });

  const server = {};
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
  let serverOrigins;

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

    const resolved = await resolveServerOrigins({
      https,
      hostname,
      acceptAnyIp,
      preferIpv6,
    });
    hostname = resolved.hostname;
    serverOrigins = resolved.serverOrigins;
    const hostnameToListen = resolved.hostnameToListen;

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

    serverPluginsController.callHooks("serverListening", { port });
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
    serverPluginsController.callHooks("serverStopped", { reason });
    await serverPluginsController.destroyAllPlugins();
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

  const connectionsTracker = trackServerPendingConnections(nodeServer);
  // opened connection must be shutdown before the close event is emitted
  stopCallbackSet.add(connectionsTracker.stop);

  const pendingRequestsTracker = trackServerPendingRequests(nodeServer);
  // ensure pending requests got a response from the server
  stopCallbackSet.add((reason) => {
    pendingRequestsTracker.stop({
      status: reason === STOP_REASON_INTERNAL_ERROR ? 500 : 503,
      reason,
    });
  });

  const applyRequestInternalRedirection = (request) => {
    serverPluginsController.callHooks(
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
  const serverTimingMinDuration =
    serverTiming && typeof serverTiming === "object"
      ? serverTiming.minDuration || 0
      : 0;
  const getResponseProperties = async (request) => {
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
        // A response can hand back measures of its own (a `timing` property —
        // durations keyed by description, null for a plain marker): they join
        // the server's own in the same server-timing header.
        if (responseProperties.timing) {
          Object.assign(timings, responseProperties.timing);
          delete responseProperties.timing;
        }
        // serverTiming.minDuration drops what took less: a request crosses
        // every registered route, and a wall of sub-millisecond ".routing"
        // entries buries the measures worth reading. Markers (null) and the
        // overall "time to start responding" — the summary the rest details —
        // always stay.
        const timingsWorthReading = {};
        for (const name of Object.keys(timings)) {
          const duration = timings[name];
          if (
            name === startRespondingTiming.name ||
            typeof duration !== "number" ||
            duration >= serverTimingMinDuration
          ) {
            timingsWorthReading[name] = duration;
          }
        }
        responseProperties.headers = composeTwoHeaders(
          responseProperties.headers,
          timingToServerTimingResponseHeaders(timingsWorthReading),
        );
      }
      if (requestWaitingMs) {
        clearTimeout(requestWaitingTimeout);
      }
      if (
        request.method !== "HEAD" &&
        responseProperties.headers &&
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
      serverPluginsController.callHooks(
        "injectResponseProperties",
        request,
        responseProperties,
        (returnValue) => {
          if (!returnValue) {
            return;
          }
          responseProperties = composeTwoResponses(
            responseProperties,
            returnValue,
          );
        },
      );
      serverPluginsController.callHooks("inspectResponse", request, {
        response: responseProperties,
        warn: (message) => {
          request.logger.warn(message);
        },
      });
      return responseProperties;
    };

    let timeout;
    let timedOut = false;
    try {
      request = applyRequestInternalRedirection(request);
      const timeoutResponsePropertiesPromise = new Promise((resolve) => {
        timeout = setTimeout(() => {
          timedOut = true;
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
          canExposeSensitiveData,
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
        await serverPluginsController.callAsyncHooks(
          "augmentRouteFetchSecondArg",
          request,
          fetchSecondArg,
          (properties) => {
            if (properties) {
              Object.assign(fetchSecondArg, properties);
            }
          },
        );
        Object.assign(
          fetchSecondArg,
          createPermissionHelpers(serverPluginsController, request),
        );
        const routerResponseProperties = await router.match(
          request,
          fetchSecondArg,
        );
        return routerResponseProperties;
      })();
      // once the 504 is sent the route keeps running: what it throws
      // afterwards would have nobody to reject to
      routerResponsePropertiesPromise.catch((e) => {
        if (timedOut) {
          logger.error(
            createDetailedMessage(`error after the 504 timeout response`, {
              "request url": request.url,
              "error stack": e.stack,
            }),
          );
        }
      });
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
        await serverPluginsController.callAsyncHooksUntil("handleError", e, {
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
    const ignoreBody = request.method === "HEAD";
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
      let request;
      try {
        request = fromNodeRequest(nodeRequest, {
          signal: stopAbortSignal,
          serverOrigin,
          logger,
        });
      } catch (e) {
        // the request cannot even be read: there is nothing to hand to the routes
        logger.error(
          createDetailedMessage(`error while reading request`, {
            "request url": nodeRequest.url,
            "error stack": e.stack,
          }),
        );
        nodeResponse.writeHead(500);
        nodeResponse.end();
        return;
      }

      try {
        const responseProperties = await getResponseProperties(request);
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
      let request;
      try {
        request = fromNodeRequest(nodeRequest, {
          signal: stopAbortSignal,
          serverOrigin,
          logger,
        });
      } catch (e) {
        logger.error(
          createDetailedMessage(`error while reading upgrade request`, {
            "request url": nodeRequest.url,
            "error stack": e.stack,
          }),
        );
        socket.write(`HTTP/1.1 500 Internal Server Error\r\n\r\n`);
        socket.destroy();
        return;
      }
      const [receiveRequestOperation, sendResponseOperation] =
        prepareHandleRequestOperations(nodeRequest, socket);
      const responseProperties = await getResponseProperties(request);
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
    // see server_polyglot.js, upgrade must be listened on https server when used
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
    if (serverOrigins.externalip) {
      logger.info(
        `${serverName} started at ${serverOrigins.local} (${serverOrigins.externalip})`,
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
    return createSecureServer({
      certificate,
      privateKey,
      http2,
      http1Allowed,
    });
  }
  const { createServer } = await import("node:http");
  return createServer();
};

const PROCESS_TEARDOWN_EVENTS_MAP = {
  SIGHUP: STOP_REASON_PROCESS_SIGHUP,
  SIGTERM: STOP_REASON_PROCESS_SIGTERM,
  SIGINT: STOP_REASON_PROCESS_SIGINT,
  beforeExit: STOP_REASON_PROCESS_BEFORE_EXIT,
  exit: STOP_REASON_PROCESS_EXIT,
};
