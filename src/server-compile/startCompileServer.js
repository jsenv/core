// https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js

import { resolveNodeModuleSpecifier } from "@jsenv/module-resolution"
import { createCancellationToken } from "@dmail/cancellation"
import { requestToFileResponse } from "../requestToFileResponse/index.js"
import {
  startServer,
  requestToAccessControlHeaders,
  serviceCompose,
  responseCompose,
} from "../server/index.js"
import { localRoot as selfLocalRoot } from "../localRoot.js"
import { createJsCompileService } from "./createJsCompileService.js"

export const startCompileServer = async ({
  cancellationToken = createCancellationToken(),
  localRoot,
  compileInto,
  locate,
  compileGroupCount,
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
  verbose,
}) => {
  const jsCompileService = await createJsCompileService({
    cancellationToken,
    localRoot,
    compileInto,
    locate,
    compileGroupCount,
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
      locate: locateFileSystem,
      cacheIgnore: sourceCacheIgnore,
      cacheStrategy: sourceCacheStrategy,
    }),
  )

  const requestToResponse = preventCors
    ? service
    : async (request) => {
        const accessControlHeaders = requestToAccessControlHeaders(request)

        if (request.method === "OPTIONS") {
          return {
            status: 200,
            headers: {
              ...accessControlHeaders,
              "content-length": 0,
            },
          }
        }

        const response = await service(request)

        return responseCompose({ headers: accessControlHeaders }, response)
      }

  const compileServer = await startServer({
    cancellationToken,
    protocol,
    ip,
    port,
    signature,
    requestToResponse,
    verbose,
    startedMessage: ({ origin }) => `compile server started for ${localRoot} at ${origin}`,
    stoppedMessage: (reason) => `compile server stopped because ${reason}`,
  })
  // https://nodejs.org/api/net.html#net_server_unref
  // but while debugging it may close the server too soon, to be tested
  compileServer.nodeServer.unref()

  return compileServer
}

const locateFileSystem = ({ requestFile, localRoot }) => {
  // future consumer of dev-server will use
  // 'node_modules/dev-server/dist/browserSystemImporter.js'
  // to get file from dev-server module
  // in order to test this behaviour, when we are working on this module
  // 'node_modules/dev-server` is an alias to localRoot
  if (localRoot === selfLocalRoot && requestFile.startsWith("node_modules/dev-server/")) {
    requestFile = requestFile.slice("node_modules/dev-server/".length)
  }

  if (requestFile.startsWith("node_modules/")) {
    const moduleSpecifier = requestFile.slice("node_modules/".length)
    const nodeModuleFile = resolveNodeModuleSpecifier({
      moduleSpecifier,
      file: `${localRoot}/${requestFile}`,
    })
    return nodeModuleFile
  }

  return `${localRoot}/${requestFile}`
}
