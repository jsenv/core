import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem";
import { Abort, raceProcessTeardownEvents } from "@jsenv/abort";
import { createLogger, createTaskLog } from "@jsenv/log";
import {
  jsenvAccessControlAllowedHeaders,
  startServer,
  jsenvServiceCORS,
  jsenvServiceErrorHandler,
} from "@jsenv/server";
import { convertFileSystemErrorToResponseProperties } from "@jsenv/server/src/internal/convertFileSystemErrorToResponseProperties.js";

import { lookupPackageDirectory } from "../helpers/lookup_package_directory.js";
import { createServerEventsDispatcher } from "../plugins/server_events/server_events_dispatcher.js";
import { defaultRuntimeCompat } from "../build/build.js";
import { createFileService } from "./file_service.js";

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
  cooldownBetweenFileEvents,

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
  transpilation,
  cacheControl = true,
  ribbon = true,
  // toolbar = false,

  sourcemaps = "inline",
  sourcemapsSourcesProtocol,
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
  const contextCache = new Map();
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
    services: [
      {
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
      },
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
      ...services,
      {
        name: "jsenv:omega_file_service",
        handleRequest: createFileService({
          signal,
          logLevel,
          serverStopCallbacks,
          serverEventsDispatcher,
          contextCache,

          sourceDirectoryUrl,
          sourceMainFilePath,
          sourceFilesConfig,
          runtimeCompat,

          plugins,
          referenceAnalysis,
          nodeEsmResolution,
          magicExtensions,
          magicDirectoryIndex,
          supervisor,
          transpilation,
          clientAutoreload,
          cooldownBetweenFileEvents,
          cacheControl,
          ribbon,
          sourcemaps,
          sourcemapsSourcesProtocol,
          sourcemapsSourcesContent,
          outDirectoryUrl,
        }),
        handleWebsocket: (websocket, { request }) => {
          if (request.headers["sec-websocket-protocol"] === "jsenv") {
            serverEventsDispatcher.addWebsocket(websocket, request);
          }
        },
      },
      {
        name: "jsenv:omega_error_handler",
        handleError: (error) => {
          const getResponseForError = () => {
            if (error && error.asResponse) {
              return error.asResponse();
            }
            if (
              error &&
              error.statusText === "Unexpected directory operation"
            ) {
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
      },
      // default error handling
      jsenvServiceErrorHandler({
        sendErrorDetails: true,
      }),
    ],
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
    contextCache,
  };
};
