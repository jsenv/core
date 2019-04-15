/* eslint-disable import/max-dependencies */
import { normalizePathname } from "@jsenv/module-resolution"
import { createCancellationToken } from "@dmail/cancellation"
import { fileWrite } from "@dmail/helper"
import { ROOT_FOLDER } from "../ROOT_FOLDER.js"
import { requestToFileResponse } from "../requestToFileResponse/index.js"
import {
  startServer,
  requestToAccessControlHeaders,
  serviceCompose,
  responseCompose,
} from "../server/index.js"
import {
  generateGroupMap,
  browserScoreMap as browserDefaultScoreMap,
  nodeVersionScoreMap as nodeDefaultVersionScoreMap,
} from "../group-map/index.js"
import { createCompileService } from "./compile-service/createCompileService.js"
import { compileJs } from "./compile-js/index.js"
import { compileImportMap } from "./compile-import-map/index.js"

export const startCompileServer = async ({
  cancellationToken = createCancellationToken(),
  projectFolder,
  compileInto,
  // option related to compile groups
  compileGroupCount = 1,
  babelConfigMap,
  babelCompatMap,
  browserScoreMap = browserDefaultScoreMap,
  nodeVersionScoreMap = nodeDefaultVersionScoreMap,
  // options related to how cache/hotreloading
  watchSource = false,
  watchSourcePredicate = () => true,
  clientCompileCacheStrategy = "etag",
  serverCompileCacheStrategy = "etag",
  serverCompileCacheTrackHit = false,
  enableGlobalLock = true,
  clientSourceCacheStrategy = "etag",
  // js compile options
  transformTopLevelAwait,
  // options related to the server itself
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

  const groupMap = generateGroupMap({
    babelConfigMap,
    babelCompatMap,
    platformScoreMap: { ...browserScoreMap, node: nodeVersionScoreMap },
    groupCount: compileGroupCount,
  })

  await Promise.all([
    fileWrite(
      `${projectFolder}/${compileInto}/groupMap.json`,
      JSON.stringify(groupMap, null, "  "),
    ),
  ])

  const compileService = await createCompileService({
    cancellationToken,
    projectFolder,

    compileInto,
    watchSource,
    watchSourcePredicate,
    clientCompileCacheStrategy,
    serverCompileCacheStrategy,
    serverCompileCacheTrackHit,
    enableGlobalLock,
    compileImportMap: ({ compileId, source }) =>
      compileImportMap({
        compileInto,
        compileId,
        source,
      }),
    compileJs: ({ compileId, filenameRelative, filename, source }) => {
      const groupBabelConfigMap = {}
      groupMap[compileId].incompatibleNameArray.forEach((incompatibleFeatureName) => {
        if (incompatibleFeatureName in babelConfigMap) {
          groupBabelConfigMap[incompatibleFeatureName] = babelConfigMap[incompatibleFeatureName]
        }
      })

      return compileJs({
        projectFolder,
        compileInto,
        compileId,
        filenameRelative,
        filename,
        source,
        babelConfigMap: groupBabelConfigMap,
        transformTopLevelAwait,
      })
    },
  })

  const compileOrServeFileService = serviceCompose(compileService, (request) =>
    requestToFileResponse(request, {
      projectFolder,
      locate: locateFileSystem,
      cacheStrategy: clientSourceCacheStrategy,
    }),
  )

  const requestToResponse = preventCors
    ? compileOrServeFileService
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

        const response = await compileOrServeFileService(request)
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
  if (filenameRelative.startsWith("node_modules/@jsenv/core")) {
    const sourceOrigin = `file://${ROOT_FOLDER}`
    if (rootHref === sourceOrigin || rootHref.startsWith(`${sourceOrigin}/`)) {
      const filenameRelativeSelf = filenameRelative.slice("node_modules/@jsenv/core/".length)
      return `${sourceOrigin}/${filenameRelativeSelf}`
    }
  }

  return `${rootHref}/${filenameRelative}`
}
