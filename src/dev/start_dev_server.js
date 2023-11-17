import { readFileSync } from "node:fs";
import { URL_META } from "@jsenv/url-meta";
import {
  assertAndNormalizeDirectoryUrl,
  bufferToEtag,
} from "@jsenv/filesystem";
import { Abort, raceProcessTeardownEvents } from "@jsenv/abort";
import { createLogger, createTaskLog } from "@jsenv/log";
import {
  jsenvAccessControlAllowedHeaders,
  startServer,
  jsenvServiceCORS,
  jsenvServiceErrorHandler,
  serveDirectory,
  composeTwoResponses,
} from "@jsenv/server";
import { convertFileSystemErrorToResponseProperties } from "@jsenv/server/src/internal/convertFileSystemErrorToResponseProperties.js";

import { WEB_URL_CONVERTER } from "../helpers/web_url_converter.js";
import { watchSourceFiles } from "../helpers/watch_source_files.js";
import { createEventEmitter } from "../helpers/event_emitter.js";
import { lookupPackageDirectory } from "../helpers/lookup_package_directory.js";
import { createServerEventsDispatcher } from "../plugins/server_events/server_events_dispatcher.js";
import { defaultRuntimeCompat } from "../build/build.js";
import { createKitchen } from "../kitchen/kitchen.js";
import { getCorePlugins } from "../plugins/plugins.js";
import { jsenvPluginServerEventsClientInjection } from "../plugins/server_events/jsenv_plugin_server_events_client_injection.js";
import { parseUserAgentHeader } from "./user_agent.js";

/**
 * Start a server for source files:
 * - cook source files according to jsenv plugins
 * - inject code to autoreload the browser when a file is modified
 * @param {Object} devServerParameters
 * @param {string|url} devServerParameters.sourceDirectoryUrl Root directory of the project
 * @return {Object} A dev server object
 */
export const startDevServer = async ({
  sourceDirectoryUrl,
  sourceMainFilePath = "./index.html",
  ignore,
  port = 3456,
  hostname,
  acceptAnyIp,
  https,
  // it's better to use http1 by default because it allows to get statusText in devtools
  // which gives valuable information when there is errors
  http2 = false,
  logLevel = process.env.IMPORTED_BY_TEST_PLAN ? "warn" : "info",
  serverLogLevel = "warn",
  services = [],

  signal = new AbortController().signal,
  handleSIGINT = true,
  keepProcessAlive = true,
  onStop = () => {},

  sourceFilesConfig,
  clientAutoreload = true,

  // runtimeCompat is the runtimeCompat for the build
  // when specified, dev server use it to warn in case
  // code would be supported during dev but not after build
  runtimeCompat = defaultRuntimeCompat,
  plugins = [],
  referenceAnalysis = {},
  nodeEsmResolution,
  supervisor = true,
  magicExtensions,
  magicDirectoryIndex,
  injections,
  transpilation,
  cacheControl = true,
  ribbon = true,
  // toolbar = false,
  onKitchenCreated = () => {},

  sourcemaps = "inline",
  sourcemapsSourcesContent,
  outDirectoryUrl,
  ...rest
}) => {
  // params type checking
  {
    const unexpectedParamNames = Object.keys(rest);
    if (unexpectedParamNames.length > 0) {
      throw new TypeError(
        `${unexpectedParamNames.join(",")}: there is no such param`,
      );
    }
    sourceDirectoryUrl = assertAndNormalizeDirectoryUrl(
      sourceDirectoryUrl,
      "sourceDirectoryUrl",
    );
    if (typeof sourceMainFilePath !== "string") {
      throw new TypeError(
        `sourceMainFilePath must be a string, got ${sourceMainFilePath}`,
      );
    }
    if (outDirectoryUrl === undefined) {
      if (!process.env.CI) {
        const packageDirectoryUrl = lookupPackageDirectory(sourceDirectoryUrl);
        if (packageDirectoryUrl) {
          outDirectoryUrl = `${packageDirectoryUrl}.jsenv/`;
        }
      }
    } else if (outDirectoryUrl !== null && outDirectoryUrl !== false) {
      outDirectoryUrl = assertAndNormalizeDirectoryUrl(
        outDirectoryUrl,
        "outDirectoryUrl",
      );
    }
  }

  // params normalization
  {
    if (clientAutoreload === true) {
      clientAutoreload = {};
    }
    if (clientAutoreload === false) {
      clientAutoreload = { enabled: false };
    }
  }

  const logger = createLogger({ logLevel });
  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);
  if (handleSIGINT) {
    operation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          SIGINT: true,
        },
        abort,
      );
    });
  }
  const startDevServerTask = createTaskLog("start dev server", {
    disabled: !logger.levels.info,
  });

  const serverStopCallbacks = [];
  const serverEventsDispatcher = createServerEventsDispatcher();
  serverStopCallbacks.push(() => {
    serverEventsDispatcher.destroy();
  });
  const kitchenCache = new Map();

  const finalServices = [];
  // x-server-inspect service
  {
    finalServices.push({
      handleRequest: (request) => {
        if (request.headers["x-server-inspect"]) {
          return { status: 200 };
        }
        if (request.pathname === "/__params__.json") {
          const json = JSON.stringify({
            sourceDirectoryUrl,
          });
          return {
            status: 200,
            headers: {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(json),
            },
            body: json,
          };
        }
        return null;
      },
      injectResponseHeaders: () => {
        return { server: "jsenv_dev_server/1" };
      },
    });
  }
  // cors service
  {
    finalServices.push(
      jsenvServiceCORS({
        accessControlAllowRequestOrigin: true,
        accessControlAllowRequestMethod: true,
        accessControlAllowRequestHeaders: true,
        accessControlAllowedRequestHeaders: [
          ...jsenvAccessControlAllowedHeaders,
          "x-jsenv-execution-id",
        ],
        accessControlAllowCredentials: true,
        timingAllowOrigin: true,
      }),
    );
  }
  // custom services
  {
    finalServices.push(...services);
  }
  // file_service
  {
    const clientFileChangeEventEmitter = createEventEmitter();
    const clientFileDereferencedEventEmitter = createEventEmitter();
    clientAutoreload = {
      enabled: true,
      clientServerEventsConfig: {},
      clientFileChangeEventEmitter,
      clientFileDereferencedEventEmitter,
      ...clientAutoreload,
    };
    const stopWatchingSourceFiles = watchSourceFiles(
      sourceDirectoryUrl,
      (fileInfo) => {
        clientFileChangeEventEmitter.emit(fileInfo);
      },
      {
        sourceFilesConfig,
        keepProcessAlive: false,
        cooldownBetweenFileEvents: clientAutoreload.cooldownBetweenFileEvents,
      },
    );
    serverStopCallbacks.push(stopWatchingSourceFiles);

    const getOrCreateKitchen = (request) => {
      const { runtimeName, runtimeVersion } = parseUserAgentHeader(
        request.headers["user-agent"] || "",
      );
      const runtimeId = `${runtimeName}@${runtimeVersion}`;
      const existing = kitchenCache.get(runtimeId);
      if (existing) {
        return existing;
      }
      const watchAssociations = URL_META.resolveAssociations(
        { watch: stopWatchingSourceFiles.watchPatterns },
        sourceDirectoryUrl,
      );
      let kitchen;
      clientFileChangeEventEmitter.on(({ url }) => {
        const urlInfo = kitchen.graph.getUrlInfo(url);
        if (urlInfo) {
          urlInfo.onModified();
        }
      });
      const clientRuntimeCompat = { [runtimeName]: runtimeVersion };

      kitchen = createKitchen({
        name: runtimeId,
        signal,
        logLevel,
        rootDirectoryUrl: sourceDirectoryUrl,
        mainFilePath: sourceMainFilePath,
        ignore,
        dev: true,
        runtimeCompat,
        clientRuntimeCompat,
        plugins: [
          ...plugins,
          ...getCorePlugins({
            rootDirectoryUrl: sourceDirectoryUrl,
            runtimeCompat,

            referenceAnalysis,
            nodeEsmResolution,
            magicExtensions,
            magicDirectoryIndex,
            supervisor,
            injections,
            transpilation,

            clientAutoreload,
            cacheControl,
            ribbon,
          }),
        ],
        supervisor,
        minification: false,
        sourcemaps,
        sourcemapsSourcesContent,
        outDirectoryUrl: outDirectoryUrl
          ? new URL(`${runtimeName}@${runtimeVersion}/`, outDirectoryUrl)
          : undefined,
      });
      kitchen.graph.urlInfoCreatedEventEmitter.on((urlInfoCreated) => {
        const { watch } = URL_META.applyAssociations({
          url: urlInfoCreated.url,
          associations: watchAssociations,
        });
        urlInfoCreated.isWatched = watch;
        // when an url depends on many others, we check all these (like package.json)
        urlInfoCreated.isValid = () => {
          if (!urlInfoCreated.url.startsWith("file:")) {
            return false;
          }
          if (urlInfoCreated.content === undefined) {
            // urlInfo content is undefined when:
            // - url info content never fetched
            // - it is considered as modified because undelying file is watched and got saved
            // - it is considered as modified because underlying file content
            //   was compared using etag and it has changed
            return false;
          }
          if (!watch) {
            // file is not watched, check the filesystem
            let fileContentAsBuffer;
            try {
              fileContentAsBuffer = readFileSync(new URL(urlInfoCreated.url));
            } catch (e) {
              if (e.code === "ENOENT") {
                urlInfoCreated.onModified();
                return false;
              }
              return false;
            }
            const fileContentEtag = bufferToEtag(fileContentAsBuffer);
            if (fileContentEtag !== urlInfoCreated.originalContentEtag) {
              urlInfoCreated.onModified();
              // restore content to be able to compare it again later
              urlInfoCreated.kitchen.urlInfoTransformer.setContent(
                urlInfoCreated,
                String(fileContentAsBuffer),
                {
                  contentEtag: fileContentEtag,
                },
              );
              return false;
            }
          }
          for (const implicitUrl of urlInfoCreated.implicitUrlSet) {
            const implicitUrlInfo =
              urlInfoCreated.graph.getUrlInfo(implicitUrl);
            if (implicitUrlInfo && !implicitUrlInfo.isValid()) {
              return false;
            }
          }
          return true;
        };
      });
      kitchen.graph.urlInfoDereferencedEventEmitter.on(
        (urlInfoDereferenced, lastReferenceFromOther) => {
          clientFileDereferencedEventEmitter.emit(
            urlInfoDereferenced,
            lastReferenceFromOther,
          );
        },
      );

      serverStopCallbacks.push(() => {
        kitchen.pluginController.callHooks("destroy", kitchen.context);
      });
      server_events: {
        const allServerEvents = {};
        kitchen.pluginController.plugins.forEach((plugin) => {
          const { serverEvents } = plugin;
          if (serverEvents) {
            Object.keys(serverEvents).forEach((serverEventName) => {
              // we could throw on serverEvent name conflict
              // we could throw if serverEvents[serverEventName] is not a function
              allServerEvents[serverEventName] = serverEvents[serverEventName];
            });
          }
        });
        const serverEventNames = Object.keys(allServerEvents);
        if (serverEventNames.length > 0) {
          Object.keys(allServerEvents).forEach((serverEventName) => {
            const serverEventInfo = {
              ...kitchen.context,
              sendServerEvent: (data) => {
                serverEventsDispatcher.dispatch({
                  type: serverEventName,
                  data,
                });
              },
            };
            const serverEventInit = allServerEvents[serverEventName];
            serverEventInit(serverEventInfo);
          });
          // "pushPlugin" so that event source client connection can be put as early as possible in html
          kitchen.pluginController.pushPlugin(
            jsenvPluginServerEventsClientInjection(
              clientAutoreload.clientServerEventsConfig,
            ),
          );
        }
      }

      kitchenCache.set(runtimeId, kitchen);
      onKitchenCreated(kitchen);
      return kitchen;
    };

    finalServices.push({
      name: "jsenv:omega_file_service",
      handleRequest: async (request) => {
        const kitchen = getOrCreateKitchen(request);
        const serveHookInfo = {
          ...kitchen.context,
          request,
        };
        const responseFromPlugin =
          await kitchen.pluginController.callAsyncHooksUntil(
            "serve",
            serveHookInfo,
          );
        if (responseFromPlugin) {
          return responseFromPlugin;
        }
        const { referer } = request.headers;
        const parentUrl = referer
          ? WEB_URL_CONVERTER.asFileUrl(referer, {
              origin: request.origin,
              rootDirectoryUrl: sourceDirectoryUrl,
            })
          : sourceDirectoryUrl;
        let reference = kitchen.graph.inferReference(
          request.resource,
          parentUrl,
        );
        if (!reference) {
          reference =
            kitchen.graph.rootUrlInfo.dependencies.createResolveAndFinalize({
              trace: { message: parentUrl },
              type: "http_request",
              specifier: request.resource,
            });
        }
        const urlInfo = reference.urlInfo;
        const ifNoneMatch = request.headers["if-none-match"];
        const urlInfoTargetedByCache = urlInfo.findParentIfInline() || urlInfo;

        try {
          if (!urlInfo.error && ifNoneMatch) {
            const [clientOriginalContentEtag, clientContentEtag] =
              ifNoneMatch.split("_");
            if (
              urlInfoTargetedByCache.originalContentEtag ===
                clientOriginalContentEtag &&
              urlInfoTargetedByCache.contentEtag === clientContentEtag &&
              urlInfoTargetedByCache.isValid()
            ) {
              const headers = {
                "cache-control": `private,max-age=0,must-revalidate`,
              };
              Object.keys(urlInfo.headers).forEach((key) => {
                if (key !== "content-length") {
                  headers[key] = urlInfo.headers[key];
                }
              });
              return {
                status: 304,
                headers,
              };
            }
          }

          await urlInfo.cook({ request, reference });
          let { response } = urlInfo;
          if (response) {
            return response;
          }
          response = {
            url: reference.url,
            status: 200,
            headers: {
              // when we send eTag to the client the next request to the server
              // will send etag in request headers.
              // If they match jsenv bypass cooking and returns 304
              // This must not happen when a plugin uses "no-store" or "no-cache" as it means
              // plugin logic wants to happens for every request to this url
              ...(urlInfo.headers["cache-control"] === "no-store" ||
              urlInfo.headers["cache-control"] === "no-cache"
                ? {}
                : {
                    "cache-control": `private,max-age=0,must-revalidate`,
                    // it's safe to use "_" separator because etag is encoded with base64 (see https://stackoverflow.com/a/13195197)
                    "eTag": `${urlInfoTargetedByCache.originalContentEtag}_${urlInfoTargetedByCache.contentEtag}`,
                  }),
              ...urlInfo.headers,
              "content-type": urlInfo.contentType,
              "content-length": urlInfo.contentLength,
            },
            body: urlInfo.content,
            timing: urlInfo.timing,
          };
          const augmentResponseInfo = {
            ...kitchen.context,
            reference,
            urlInfo,
          };
          kitchen.pluginController.callHooks(
            "augmentResponse",
            augmentResponseInfo,
            (returnValue) => {
              response = composeTwoResponses(response, returnValue);
            },
          );
          return response;
        } catch (e) {
          urlInfo.error = e;
          const originalError = e ? e.cause || e : e;
          if (originalError.asResponse) {
            return originalError.asResponse();
          }
          const code = originalError.code;
          if (code === "PARSE_ERROR") {
            // when possible let browser re-throw the syntax error
            // it's not possible to do that when url info content is not available
            // (happens for js_module_fallback for instance)
            if (urlInfo.content !== undefined) {
              kitchen.context.logger.error(`Error while handling ${request.url}:
${originalError.reasonCode || originalError.code}
${e.traceMessage}`);
              return {
                url: reference.url,
                status: 200,
                // reason becomes the http response statusText, it must not contain invalid chars
                // https://github.com/nodejs/node/blob/0c27ca4bc9782d658afeaebcec85ec7b28f1cc35/lib/_http_common.js#L221
                statusText: e.reason,
                statusMessage: originalError.message,
                headers: {
                  "content-type": urlInfo.contentType,
                  "content-length": urlInfo.contentLength,
                  "cache-control": "no-store",
                },
                body: urlInfo.content,
              };
            }
            return {
              url: reference.url,
              status: 500,
              statusText: e.reason,
              statusMessage: originalError.message,
              headers: {
                "cache-control": "no-store",
              },
              body: urlInfo.content,
            };
          }
          if (code === "DIRECTORY_REFERENCE_NOT_ALLOWED") {
            return serveDirectory(reference.url, {
              headers: {
                accept: "text/html",
              },
              canReadDirectory: true,
              rootDirectoryUrl: sourceDirectoryUrl,
            });
          }
          if (code === "NOT_ALLOWED") {
            return {
              url: reference.url,
              status: 403,
              statusText: originalError.reason,
            };
          }
          if (code === "NOT_FOUND") {
            return {
              url: reference.url,
              status: 404,
              statusText: originalError.reason,
              statusMessage: originalError.message,
            };
          }
          return {
            url: reference.url,
            status: 500,
            statusText: e.reason,
            statusMessage: e.stack,
          };
        }
      },
      handleWebsocket: (websocket, { request }) => {
        if (request.headers["sec-websocket-protocol"] === "jsenv") {
          serverEventsDispatcher.addWebsocket(websocket, request);
        }
      },
    });
  }
  // jsenv error handler service
  {
    finalServices.push({
      name: "jsenv:omega_error_handler",
      handleError: (error) => {
        const getResponseForError = () => {
          if (error && error.asResponse) {
            return error.asResponse();
          }
          if (error && error.statusText === "Unexpected directory operation") {
            return {
              status: 403,
            };
          }
          return convertFileSystemErrorToResponseProperties(error);
        };
        const response = getResponseForError();
        if (!response) {
          return null;
        }
        const body = JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          body: response.body,
        });
        return {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(body),
          },
          body,
        };
      },
    });
  }
  // default error handler
  {
    finalServices.push(
      jsenvServiceErrorHandler({
        sendErrorDetails: true,
      }),
    );
  }

  const server = await startServer({
    signal,
    stopOnExit: false,
    stopOnSIGINT: handleSIGINT,
    stopOnInternalError: false,
    keepProcessAlive: process.env.IMPORTED_BY_TEST_PLAN
      ? false
      : keepProcessAlive,
    logLevel: serverLogLevel,
    startLog: false,

    https,
    http2,
    acceptAnyIp,
    hostname,
    port,
    requestWaitingMs: 60_000,
    services: finalServices,
  });
  server.stoppedPromise.then((reason) => {
    onStop();
    serverStopCallbacks.forEach((serverStopCallback) => {
      serverStopCallback(reason);
    });
    serverStopCallbacks.length = 0;
  });
  startDevServerTask.done();
  if (hostname) {
    delete server.origins.localip;
    delete server.origins.externalip;
  }
  logger.info(``);
  Object.keys(server.origins).forEach((key) => {
    logger.info(`- ${server.origins[key]}`);
  });
  logger.info(``);
  return {
    origin: server.origin,
    stop: () => {
      server.stop();
    },
    kitchenCache,
  };
};
