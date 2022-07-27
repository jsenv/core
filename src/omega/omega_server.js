import {
  jsenvAccessControlAllowedHeaders,
  startServer,
  jsenvServiceCORS,
  jsenvServiceErrorHandler,
} from "@jsenv/server"
import { convertFileSystemErrorToResponseProperties } from "@jsenv/server/src/internal/convertFileSystemErrorToResponseProperties.js"
import { createServerEventsDispatcher } from "@jsenv/core/src/plugins/server_events/server_events_dispatcher.js"

import { createFileService } from "./server/file_service.js"

export const startOmegaServer = async ({
  signal,
  handleSIGINT,
  logLevel,
  protocol = "http",
  http2 = protocol === "https",
  privateKey,
  certificate,
  acceptAnyIp,
  host,
  port = 0,
  keepProcessAlive = false,
  onStop = () => {},
  services = [],

  rootDirectoryUrl,
  scenario,
  runtimeCompat,

  plugins,
  urlAnalysis,
  htmlSupervisor,
  nodeEsmResolution,
  fileSystemMagicResolution,
  transpilation,
  clientAutoreload,
  clientFiles,
  cooldownBetweenFileEvents,
  explorer,
  sourcemaps,
  sourcemapsSourcesProtocol,
  sourcemapsSourcesContent,
  writeGeneratedFiles,
}) => {
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
    logLevel,
    startLog: false,

    protocol,
    http2,
    certificate,
    privateKey,
    acceptAnyIp,
    host,
    port,
    requestWaitingMs: 60_1000,
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

          rootDirectoryUrl,
          scenario,
          runtimeCompat,

          plugins,
          urlAnalysis,
          htmlSupervisor,
          nodeEsmResolution,
          fileSystemMagicResolution,
          transpilation,
          clientAutoreload,
          clientFiles,
          cooldownBetweenFileEvents,
          explorer,
          sourcemaps,
          sourcemapsSourcesProtocol,
          sourcemapsSourcesContent,
          writeGeneratedFiles,
        }),
        handleWebsocket: (websocket) => {
          serverEventsDispatcher.addWebsocket(websocket)
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
  return server
}
