import {
  jsenvAccessControlAllowedHeaders,
  startServer,
  composeServices,
  pluginServerTiming,
  pluginRequestWaitingCheck,
  pluginCORS,
} from "@jsenv/server"
import { convertFileSystemErrorToResponseProperties } from "@jsenv/server/src/internal/convertFileSystemErrorToResponseProperties.js"
import { createCallbackListNotifiedOnce } from "@jsenv/abort"
import { createLogger } from "@jsenv/logger"

import { createRessourceGraph } from "./ressource_graph.js"
import { createFileService } from "./file_service.js"
import { createSSEService } from "./sse_service.js"

export const startOmegaServer = async ({
  signal = new AbortController().signal,
  handleSIGINT,
  logLevel,
  protocol = "http",
  http2 = protocol === "https",
  privateKey,
  certificate,
  ip = "0.0.0.0",
  port = 0,
  keepProcessAlive = false,
  onStop = () => {},
  serverPlugins,
  services,

  projectDirectoryUrl,
  scenario,
  plugins,
  runtimeSupport,
  sourcemapInjection = "inline",
  autoreload = {
    dev: true,
    test: false,
  }[scenario],
  autoreloadPatterns = {
    "./**": true,
    "./**/.*/": false, // any folder starting with a dot is ignored (includes .git for instance)
    "./dist/": false,
    "./**/node_modules/": false,
  },
}) => {
  const logger = createLogger({ logLevel })

  const serverStopCallbackList = createCallbackListNotifiedOnce()
  const ressourceGraph = createRessourceGraph({ projectDirectoryUrl })
  const coreServices = {
    "jsenv:sse": createSSEService({
      projectDirectoryUrl,
      serverStopCallbackList,
      autoreload,
      autoreloadPatterns,
      ressourceGraph,
    }),
    "service:file": createFileService({
      signal,
      logger,
      projectDirectoryUrl,
      scenario,
      plugins,
      runtimeSupport,
      sourcemapInjection,
      ressourceGraph,
    }),
  }
  const server = await startServer({
    signal,
    stopOnExit: false,
    stopOnSIGINT: handleSIGINT,
    stopOnInternalError: false,
    keepProcessAlive,
    logLevel,

    protocol,
    http2,
    certificate,
    privateKey,
    ip,
    port,
    plugins: {
      ...serverPlugins,
      ...pluginCORS({
        accessControlAllowRequestOrigin: true,
        accessControlAllowRequestMethod: true,
        accessControlAllowRequestHeaders: true,
        accessControlAllowedRequestHeaders: [
          ...jsenvAccessControlAllowedHeaders,
          "x-jsenv-execution-id",
        ],
        accessControlAllowCredentials: true,
      }),
      ...pluginServerTiming(),
      ...pluginRequestWaitingCheck({
        requestWaitingMs: 60 * 1000,
      }),
    },
    sendErrorDetails: true,
    errorToResponse: (error, { request }) => {
      const getResponseForError = () => {
        if (error && error.asResponse) {
          return error.asResponse()
        }
        if (error && error.statusText === "Unexpected directory operation") {
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
      const isInspectRequest = new URL(
        request.ressource,
        request.origin,
      ).searchParams.has("__inspect__")
      if (!isInspectRequest) {
        return response
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
    requestToResponse: composeServices({
      ...services,
      ...coreServices,
    }),
    onStop: (reason) => {
      onStop()
      serverStopCallbackList.notify(reason)
    },
  })
  return {
    ...server,
  }
}
