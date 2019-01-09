// https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js

import { createCancellationToken } from "@dmail/cancellation"
import { requestToFileResponse } from "../requestToFileResponse/index.js"
import {
  startServer,
  enableCORS,
  requestToAccessControlAllowedInfo,
  serviceCompose,
} from "../server/index.js"
import { createJsCompileService } from "./createJsCompileService.js"
import { locate } from "../jsCompileToService/locate.js"

export const startCompileServer = async ({
  cancellationToken = createCancellationToken(),
  localRoot,
  compileInto,
  pluginMap,
  pluginCompatMap,
  platformUsageMap,
  localCacheStrategy,
  localCacheTrackHit,
  cacheStrategy,
  instrumentPredicate,
  watch,
  watchPredicate,
  sourceCacheStrategy = "etag",
  sourceCacheIgnore = false,
  preventCors = false,
  protocol,
  ip,
  port,
  signature,
}) => {
  const jsCompileService = await createJsCompileService({
    cancellationToken,
    localRoot,
    compileInto,
    pluginMap,
    pluginCompatMap,
    platformUsageMap,
    localCacheStrategy,
    localCacheTrackHit,
    cacheStrategy,
    instrumentPredicate,
    watch,
    watchPredicate,
  })

  const service = serviceCompose(jsCompileService, (request) =>
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

  const compileServer = await startServer({
    cancellationToken,
    protocol,
    ip,
    port,
    signature,
    requestToResponse,
    startedMessage: ({ origin }) => `compile server started for ${localRoot} at ${origin}`,
    stoppedMessage: (reason) => `compile server stopped because ${reason}`,
  })
  // https://nodejs.org/api/net.html#net_server_unref
  // but while debugging it may close the server too soon, to be tested
  compileServer.nodeServer.unref()

  return compileServer
}
