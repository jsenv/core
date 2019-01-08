// https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js

import { createCancellationToken } from "@dmail/cancellation"
import { requestToFileResponse } from "../requestToFileResponse/index.js"
import {
  open as serverOpen,
  enableCORS,
  requestToAccessControlAllowedInfo,
  serviceCompose,
} from "../server/index.js"
import { locate } from "../jsCompileToService/locate.js"

export const openCompileServer = async ({
  cancellationToken = createCancellationToken(),
  // server options
  protocol,
  ip,
  port,
  preventCors = false,

  localRoot,
  compileService,

  // compile options
  sourceCacheStrategy = "etag",
  sourceCacheIgnore = false,
}) => {
  if (typeof compileService !== "function") throw new TypeError(`compileService must be a function`)

  const service = serviceCompose(compileService, (request) =>
    requestToFileResponse(request, {
      localRoot,
      locate,
      cacheIgnore: sourceCacheIgnore,
      cacheStrategy: sourceCacheStrategy,
    }),
  )

  const requestToResponse = preventCors
    ? service
    : async (request) => {
        const accessControlAllowedInfo = requestToAccessControlAllowedInfo(request)

        if (request.method === "OPTIONS") {
          return enableCORS(
            {
              status: 200,
              headers: {
                "content-length": 0,
              },
            },
            accessControlAllowedInfo,
          )
        }

        const response = await service(request)
        return enableCORS(response, accessControlAllowedInfo)
      }

  const compileServer = await serverOpen({
    cancellationToken,
    protocol,
    ip,
    port,
    requestToResponse,
    openedMessage: ({ origin }) => `compiling ${localRoot} at ${origin}`,
    closedMessage: (reason) => `compile server closed because ${reason}`,
  })
  // https://nodejs.org/api/net.html#net_server_unref
  compileServer.nodeServer.unref()

  return compileServer
}
