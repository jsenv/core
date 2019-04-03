import { normalizePathname } from "/node_modules/@jsenv/module-resolution/index.js"
import { createCancellationToken } from "/node_modules/@dmail/cancellation/index.js"
import { requestToFileResponse } from "../requestToFileResponse/index.js"
import {
  startServer,
  requestToAccessControlHeaders,
  serviceCompose,
  responseCompose,
} from "../server/index.js"
import { createJsCompileService } from "./createJsCompileService.js"

const { projectFolder: selfProjectFolder } = import.meta.require("../../jsenv.config.js")

export const startCompileServer = async ({
  cancellationToken = createCancellationToken(),
  importMap,
  projectFolder,
  compileInto,
  compileGroupCount = 1,
  babelConfigMap,
  locate,
  localCacheStrategy,
  localCacheTrackHit,
  cacheStrategy,
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
  if (typeof projectFolder !== "string")
    throw new TypeError(`projectFolder must be a string. got ${projectFolder}`)

  projectFolder = normalizePathname(projectFolder)
  const jsCompileService = await createJsCompileService({
    cancellationToken,
    importMap,
    projectFolder,
    compileInto,
    compileGroupCount,
    babelConfigMap,
    locate,
    localCacheStrategy,
    localCacheTrackHit,
    cacheStrategy,
    watch,
    watchPredicate,
  })

  const service = serviceCompose(jsCompileService, (request) =>
    requestToFileResponse(request, {
      projectFolder,
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
    startedMessage: ({ origin }) => `compile server started for ${projectFolder} at ${origin}`,
    stoppedMessage: (reason) => `compile server stopped because ${reason}`,
  })
  // https://nodejs.org/api/net.html#net_server_unref
  // but while debugging it may close the server too soon, to be tested
  compileServer.nodeServer.unref()

  return compileServer
}

const locateFileSystem = ({ rootHref, filenameRelative }) => {
  // consumer of @jsenv/core use
  // 'node_modules/@jsenv/core/dist/browserSystemImporter.js'
  // to get file.
  // in order to test this behaviour while developping @jsenv/core
  // 'node_modules/@jsenv/core` is an alias to rootHref
  if (filenameRelative.startsWith("node_modules/@jsenv/core/")) {
    const sourceOrigin = `file://${selfProjectFolder}`
    if (rootHref === sourceOrigin || rootHref.startsWith(`${sourceOrigin}/`)) {
      const filenameRelativeSelf = filenameRelative.slice("node_modules/@jsenv/core/".length)
      return `${sourceOrigin}/${filenameRelativeSelf}`
    }
  }

  return `${rootHref}/${filenameRelative}`
}
