import {
  jsenvAccessControlAllowedHeaders,
  startServer,
  composeServices,
  pluginServerTiming,
  pluginRequestWaitingCheck,
  pluginCORS,
} from "@jsenv/server"
import { convertFileSystemErrorToResponseProperties } from "@jsenv/server/src/internal/convertFileSystemErrorToResponseProperties.js"
import {
  createCallbackListNotifiedOnce,
  createCallbackList,
} from "@jsenv/abort"

import { createSSEService } from "@jsenv/core/src/helpers/event_source/sse_service.js"
import { createFileService } from "./server/file_service.js"

export const startOmegaServer = async ({
  signal,
  handleSIGINT,
  logLevel,
  protocol = "http",
  http2 = protocol === "https",
  privateKey,
  certificate,
  listenAnyIp,
  ip,
  port = 0,
  keepProcessAlive = false,
  onStop = () => {},
  serverPlugins,
  services,

  rootDirectoryUrl,
  scenario,
  urlGraph,
  kitchen,
}) => {
  const serverStopCallbackList = createCallbackListNotifiedOnce()

  const serverEventCallbackList = createCallbackList()
  const sseService = createSSEService({ serverEventCallbackList })
  const sendServerEvent = ({ type, data }) => {
    serverEventCallbackList.notify({
      type,
      data: JSON.stringify(data),
    })
  }

  kitchen.pluginController.addHook("registerServerEvents")
  kitchen.pluginController.callHooks(
    "registerServerEvents",
    { sendServerEvent },
    {
      rootDirectoryUrl,
      urlGraph,
      scenario,
    },
    () => {},
  )

  const coreServices = {
    "service:server_events": (request) => {
      const { accept } = request.headers
      if (accept && accept.includes("text/event-stream")) {
        const room = sseService.getOrCreateSSERoom(request)
        return room.join(request)
      }
      return null
    },
    "service:file": createFileService({
      rootDirectoryUrl,
      urlGraph,
      kitchen,
      scenario,
      onFileNotFound: (data) => {
        // setTimeout display first the error
        // dispatched on window by browser
        // then display the jsenv error
        setTimeout(() => {
          sendServerEvent({
            type: "file_not_found",
            data,
          })
        }, 10)
      },
    }),
  }
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
    listenAnyIp,
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
      sseService.destroy()
      serverStopCallbackList.notify(reason)
    },
  })
  return {
    ...server,
  }
}
