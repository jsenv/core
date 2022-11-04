import { parentPort } from "node:worker_threads"
import {
  assertAndNormalizeDirectoryUrl,
  registerDirectoryLifecycle,
} from "@jsenv/filesystem"
import { Abort, raceProcessTeardownEvents } from "@jsenv/abort"
import { createLogger, createTaskLog } from "@jsenv/log"
import { getCallerPosition } from "@jsenv/urls"
import {
  jsenvAccessControlAllowedHeaders,
  startServer,
  jsenvServiceCORS,
  jsenvServiceErrorHandler,
} from "@jsenv/server"
import { convertFileSystemErrorToResponseProperties } from "@jsenv/server/src/internal/convertFileSystemErrorToResponseProperties.js"

import { createServerEventsDispatcher } from "@jsenv/core/src/plugins/server_events/server_events_dispatcher.js"
import { defaultRuntimeCompat } from "@jsenv/core/src/build/build.js"
import { createReloadableWorker } from "@jsenv/core/src/helpers/worker_reload.js"
import { createFileService } from "./file_service.js"

export const startDevServer = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel = "info",
  serverLogLevel = "warn",
  protocol = "http",
  // it's better to use http1 by default because it allows to get statusText in devtools
  // which gives valuable information when there is errors
  http2 = false,
  certificate,
  privateKey,
  hostname,
  port = 3456,
  acceptAnyIp,
  keepProcessAlive = true,
  services = [],
  onStop = () => {},

  rootDirectoryUrl,
  clientFiles = {
    "./src/": true,
    "./tests/": true,
    "./package.json": true,
  },
  devServerFiles = {
    "./package.json": true,
    "./jsenv.config.mjs": true,
  },
  clientAutoreload = true,
  clientMainFileUrl,
  devServerAutoreload = false,
  devServerMainFile = getCallerPosition().url,
  cooldownBetweenFileEvents,

  // runtimeCompat is the runtimeCompat for the build
  // when specified, dev server use it to warn in case
  // code would be supported during dev but not after build
  runtimeCompat = defaultRuntimeCompat,
  plugins = [],
  urlAnalysis = {},
  urlResolution,
  supervisor = true,
  fileSystemMagicRedirection,
  transpilation,
  explorer = true, // see jsenv_plugin_explorer.js
  ribbon = true,
  // toolbar = false,

  sourcemaps = "inline",
  sourcemapsSourcesProtocol,
  sourcemapsSourcesContent,
  // no real need to write files during github workflow
  // and mitigates https://github.com/actions/runner-images/issues/3885
  writeGeneratedFiles = !process.env.CI,
}) => {
  const logger = createLogger({ logLevel })
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl)
  const operation = Abort.startOperation()
  operation.addAbortSignal(signal)
  if (handleSIGINT) {
    operation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          SIGINT: true,
        },
        abort,
      )
    })
  }

  let reloadableWorker
  if (devServerAutoreload) {
    reloadableWorker = createReloadableWorker(devServerMainFile)
    if (reloadableWorker.isPrimary) {
      const devServerFileChangeCallback = ({ relativeUrl, event }) => {
        const url = new URL(relativeUrl, rootDirectoryUrl).href
        logger.info(`file ${event} ${url} -> restarting server...`)
        reloadableWorker.reload()
      }
      const stopWatchingDevServerFiles = registerDirectoryLifecycle(
        rootDirectoryUrl,
        {
          watchPatterns: {
            ...devServerFiles.include,
            [devServerMainFile]: true,
            ".jsenv/": false,
          },
          cooldownBetweenFileEvents,
          keepProcessAlive: false,
          recursive: true,
          added: ({ relativeUrl }) => {
            devServerFileChangeCallback({ relativeUrl, event: "added" })
          },
          updated: ({ relativeUrl }) => {
            devServerFileChangeCallback({ relativeUrl, event: "modified" })
          },
          removed: ({ relativeUrl }) => {
            devServerFileChangeCallback({ relativeUrl, event: "removed" })
          },
        },
      )
      operation.addAbortCallback(() => {
        stopWatchingDevServerFiles()
        reloadableWorker.terminate()
      })

      const worker = await reloadableWorker.load()
      const messagePromise = new Promise((resolve) => {
        worker.once("message", resolve)
      })
      const origin = await messagePromise
      return {
        origin,
        stop: () => {
          stopWatchingDevServerFiles()
          reloadableWorker.terminate()
        },
      }
    }
  }

  const startDevServerTask = createTaskLog("start dev server", {
    disabled: !logger.levels.info,
  })

  const serverStopCallbacks = []
  const serverEventsDispatcher = createServerEventsDispatcher()
  serverStopCallbacks.push(() => {
    serverEventsDispatcher.destroy()
  })
  const server = await startServer({
    signal,
    stopOnExit: false,
    stopOnSIGINT: handleSIGINT,
    stopOnInternalError: false,
    keepProcessAlive,
    logLevel: serverLogLevel,
    startLog: false,

    protocol,
    http2,
    certificate,
    privateKey,
    acceptAnyIp,
    hostname,
    port,
    requestWaitingMs: 60_000,
    services: [
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

          rootDirectoryUrl,
          scenarios: { dev: true },
          runtimeCompat,

          plugins,
          urlAnalysis,
          urlResolution,
          fileSystemMagicRedirection,
          supervisor,
          transpilation,
          clientAutoreload,
          clientFiles,
          clientMainFileUrl,
          cooldownBetweenFileEvents,
          explorer,
          ribbon,
          sourcemaps,
          sourcemapsSourcesProtocol,
          sourcemapsSourcesContent,
          writeGeneratedFiles,
        }),
        handleWebsocket: (websocket, { request }) => {
          if (request.headers["sec-websocket-protocol"] === "jsenv") {
            serverEventsDispatcher.addWebsocket(websocket, request)
          }
        },
      },
      {
        name: "jsenv:omega_error_handler",
        handleError: (error) => {
          const getResponseForError = () => {
            if (error && error.asResponse) {
              return error.asResponse()
            }
            if (
              error &&
              error.statusText === "Unexpected directory operation"
            ) {
              return {
                status: 403,
              }
            }
            return convertFileSystemErrorToResponseProperties(error)
          }
          const response = getResponseForError()
          if (!response) {
            return null
          }
          const body = JSON.stringify({
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            body: response.body,
          })
          return {
            status: 200,
            headers: {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(body),
            },
            body,
          }
        },
      },
      // default error handling
      jsenvServiceErrorHandler({
        sendErrorDetails: true,
      }),
    ],
    onStop: (reason) => {
      onStop()
      serverStopCallbacks.forEach((serverStopCallback) => {
        serverStopCallback(reason)
      })
      serverStopCallbacks.length = 0
    },
  })
  startDevServerTask.done()
  if (hostname) {
    delete server.origins.localip
    delete server.origins.externalip
  }
  logger.info(``)
  Object.keys(server.origins).forEach((key) => {
    logger.info(`- ${server.origins[key]}`)
  })
  logger.info(``)
  if (reloadableWorker && reloadableWorker.isWorker) {
    parentPort.postMessage(server.origin)
  }
  return {
    origin: server.origin,
    stop: () => {
      server.stop()
    },
  }
}
