// https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js

import { createCancellationToken } from "@dmail/cancellation"
import { requestToFileResponse } from "../requestToFileResponse/index.js"
import { open as serverOpen, enableCORS, serviceCompose } from "../server/index.js"
import { locate } from "../jsCompileToService/locate.js"

export const open = async ({
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
  const service = serviceCompose(compileService, (request) =>
    requestToFileResponse(request, {
      localRoot,
      locate,
      cacheIgnore: sourceCacheIgnore,
      cacheStrategy: sourceCacheStrategy,
    }),
  )

  const requestToResponse = (request) => {
    return service(request).then((response) => {
      return preventCors
        ? response
        : enableCORS(response, { allowedOrigins: [request.headers.origin] })
    })
  }

  return serverOpen({
    cancellationToken,
    protocol,
    ip,
    port,
    requestToResponse,
    openedMessage: ({ origin }) => `compiling ${localRoot} at ${origin}`,
    closedMessage: (reason) => `compile server closed because ${reason}`,
  })
}
