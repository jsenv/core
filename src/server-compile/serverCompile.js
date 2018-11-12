// https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js

/* eslint-disable import/max-dependencies */
import { createRequestToFileResponse } from "../createRequestToFileResponse/index.js"
import { open as serverOpen, enableCORS, serviceCompose } from "../server/index.js"
import { cancellationNone } from "../cancel/index.js"

export const open = async ({
  cancellation = cancellationNone,
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
  const service = serviceCompose(
    compileService,
    createRequestToFileResponse({
      root: localRoot,
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
    cancellation,
    protocol,
    ip,
    port,
    requestToResponse,
    openedMessage: ({ origin }) => `compiling ${localRoot} at ${origin}`,
    closedMessage: (reason) => `compile server closed because ${reason}`,
  })
}
