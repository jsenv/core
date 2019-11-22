/* eslint-disable import/max-dependencies */
import {
  catchAsyncFunctionCancellation,
  createCancellationTokenForProcessSIGINT,
} from "@jsenv/cancellation"
import { metaMapToSpecifierMetaMap, normalizeSpecifierMetaMap, urlToMeta } from "@jsenv/url-meta"
import { startServer, firstService, serveFile, createSSERoom } from "@jsenv/server"
import { registerDirectoryLifecycle } from "@jsenv/file-watcher"
import { createLogger } from "@jsenv/logger"
import { pathToDirectoryUrl, resolveFileUrl, sameOrigin } from "internal/urlUtils.js"
import { assertFileExists } from "internal/filesystemUtils.js"
import {
  assertProjectDirectoryPath,
  assertProjectDirectoryExists,
  assertImportMapFileRelativeUrl,
  assertImportMapFileInsideProject,
} from "internal/argUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { serveExploringIndex } from "internal/exploring/serveExploringIndex.js"
import { serveBrowserSelfExecute } from "internal/exploring/serveBrowserSelfExecute.js"
import { startCompileServer } from "internal/compiling/startCompileServer.js"
import { jsenvExplorableConfig } from "./jsenvExplorableConfig.js"

export const startExploring = async ({
  cancellationToken = createCancellationTokenForProcessSIGINT(),
  logLevel,
  compileServerLogLevel = logLevel,

  HTMLTemplateFileUrl = resolveFileUrl(
    "./src/internal/exploring/template.html",
    jsenvCoreDirectoryUrl,
  ),
  browserSelfExecuteTemplateFileUrl = resolveFileUrl(
    "./src/internal/exploring/browserSelfExecuteTemplate.js",
    jsenvCoreDirectoryUrl,
  ),
  explorableConfig = jsenvExplorableConfig,
  watchConfig = {
    "./**/*": true,
    "./.git/": false,
    "./node_modules/": false,
  },
  livereloading = false,

  projectDirectoryPath,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importMapFileRelativeUrl = "./importMap.json",
  importDefaultExtension,

  babelPluginMap,
  convertMap,
  compileGroupCount = 2,

  keepProcessAlive = true,
  cors = true,
  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  forcePort = false,
  certificate,
  privateKey,
}) => {
  assertProjectDirectoryPath({ projectDirectoryPath })
  const projectDirectoryUrl = pathToDirectoryUrl(projectDirectoryPath)
  await assertProjectDirectoryExists({ projectDirectoryUrl })

  assertImportMapFileRelativeUrl({ importMapFileRelativeUrl })
  const importMapFileUrl = resolveFileUrl(importMapFileRelativeUrl, projectDirectoryUrl)
  assertImportMapFileInsideProject({ importMapFileUrl, projectDirectoryUrl })

  await assertFileExists(HTMLTemplateFileUrl)
  await assertFileExists(browserSelfExecuteTemplateFileUrl)

  return catchAsyncFunctionCancellation(async () => {
    const specifierMetaMapRelativeForExplorable = metaMapToSpecifierMetaMap({
      explorable: explorableConfig,
    })
    const specifierMetaMapForExplorable = normalizeSpecifierMetaMap(
      specifierMetaMapRelativeForExplorable,
      projectDirectoryUrl,
    )

    let projectFileRequestedCallback
    let rawProjectFileRequestedCallback = () => {}
    let livereloadServerSentEventService = () => null
    let htmlTemplateRequestedCallback = () => {}

    if (livereloading) {
      watchConfig[compileDirectoryRelativeUrl] = false

      const unregisterDirectoryLifecyle = registerDirectoryLifecycle(projectDirectoryPath, {
        watchDescription: watchConfig,
        updated: ({ relativeUrl }) => {
          if (projectFileSet.has(relativeUrl)) {
            projectFileUpdatedCallback(relativeUrl)
          }
        },
        removed: ({ relativeUrl }) => {
          if (projectFileSet.has(relativeUrl)) {
            projectFileSet.delete(relativeUrl)
            projectFileRemovedCallback(relativeUrl)
          }
        },
        keepProcessAlive: false,
      })
      cancellationToken.register(unregisterDirectoryLifecyle)

      const projectFileSet = new Set()
      const roomMap = {}
      const dependencyTracker = {}

      const projectFileUpdatedCallback = (relativeUrl) => {
        projectFileToAffectedRoomArray(relativeUrl).forEach((room) => {
          room.sendEvent({
            type: "file-changed",
            data: relativeUrl,
          })
        })
      }

      const projectFileRemovedCallback = (relativeUrl) => {
        projectFileToAffectedRoomArray(relativeUrl).forEach((room) => {
          room.sendEvent({
            type: "file-removed",
            data: relativeUrl,
          })
        })
      }

      const projectFileToAffectedRoomArray = (relativeUrl) => {
        const affectedRoomArray = []
        Object.keys(roomMap).forEach((mainRelativeUrl) => {
          if (!dependencyTracker.hasOwnProperty(mainRelativeUrl)) return

          if (
            relativeUrl === mainRelativeUrl ||
            dependencyTracker[mainRelativeUrl].includes(relativeUrl)
          ) {
            affectedRoomArray.push(roomMap[mainRelativeUrl])
          }
        })
        return affectedRoomArray
      }

      const trackDependency = ({ relativeUrl, executionId }) => {
        if (executionId) {
          // quand on voit main on marque tout ce qui existe actuallement
          // comme plus dépendant ?
          // mais si ce qui était la

          if (dependencyTracker.hasOwnProperty(executionId)) {
            const dependencyArray = dependencyTracker[executionId]
            if (!dependencyArray.includes(dependencyTracker)) {
              dependencyArray.push(relativeUrl)
            }
          } else {
            dependencyTracker[executionId] = [relativeUrl]
          }
        } else {
          Object.keys(dependencyTracker).forEach((executionId) => {
            trackDependency({ relativeUrl, executionId })
          })
        }
      }

      htmlTemplateRequestedCallback = ({ relativeUrl }) => {
        dependencyTracker[relativeUrl] = []
      }

      projectFileRequestedCallback = ({ relativeUrl, request }) => {
        projectFileSet.add(relativeUrl)

        const { headers = {} } = request

        if ("x-jsenv-execution-id" in headers) {
          const executionId = headers["x-jsenv-execution-id"]
          trackDependency({ relativeUrl, executionId })
        } else if ("referer" in headers) {
          const { referer } = headers
          if (sameOrigin(referer, request.origin)) {
            const refererRelativeUrl = referer.slice(`${request.origin}/`.length)
            const refererFileUrl = `${projectDirectoryUrl}${refererRelativeUrl}`

            if (
              urlToMeta({
                url: refererFileUrl,
                specifierMetaMap: specifierMetaMapForExplorable,
              }).explorable
            ) {
              const executionId = refererRelativeUrl
              trackDependency({
                relativeUrl,
                executionId,
              })
            } else {
              Object.keys(dependencyTracker).forEach((executionId) => {
                if (
                  executionId === refererRelativeUrl ||
                  dependencyTracker[executionId].includes(refererRelativeUrl)
                ) {
                  trackDependency({
                    relativeUrl,
                    executionId,
                  })
                }
              })
            }
          } else {
            trackDependency({ relativeUrl })
          }
        } else {
          trackDependency({ relativeUrl })
        }
      }

      rawProjectFileRequestedCallback = ({ relativeUrl, request }) => {
        projectFileRequestedCallback({ relativeUrl, request })
        projectFileSet.add(relativeUrl)
      }

      livereloadServerSentEventService = ({ relativeUrl, request }) => {
        const { accept = "" } = request.headers
        if (!accept.includes("text/event-stream")) return null

        return getOrCreateRoomForRelativeUrl(relativeUrl).connect(request.headers["last-event-id"])
      }

      const getOrCreateRoomForRelativeUrl = (relativeUrl) => {
        if (roomMap.hasOwnProperty(relativeUrl)) return roomMap[relativeUrl]

        const room = createSSERoom()
        room.start()
        cancellationToken.register(room.stop)
        roomMap[relativeUrl] = room
        return room
      }
    }

    const compileServer = await startCompileServer({
      cancellationToken,
      compileServerLogLevel,

      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvDirectoryClean,
      importMapFileUrl,
      importDefaultExtension,

      env: {
        livereloading,
      },
      compileGroupCount,
      babelPluginMap,
      convertMap,

      cors,
      protocol,
      privateKey,
      certificate,
      ip,
      port: 0, // random available port
      forcePort: false, // no need because random port
      projectFileRequestedCallback,
      stopOnPackageVersionChange: true,
    })

    const {
      origin: compileServerOrigin,
      compileServerImportMap,
      outDirectoryRelativeUrl,
      jsenvDirectoryRelativeUrl: compileServerJsenvDirectoryRelativeUrl,
    } = compileServer

    const logger = createLogger({ logLevel })

    const service = (request) =>
      firstService(
        () => {
          return livereloadServerSentEventService({
            relativeUrl: request.ressource.slice(1),
            request,
          })
        },
        () => {
          return serveExploringIndex({
            projectDirectoryUrl,
            explorableConfig,
            request,
          })
        },
        () => {
          const relativeUrl = request.ressource.slice(1)
          const requestFileUrl = resolveFileUrl(relativeUrl, projectDirectoryUrl)

          if (
            !urlToMeta({
              url: requestFileUrl,
              specifierMetaMap: specifierMetaMapForExplorable,
            }).explorable
          ) {
            return null
          }

          htmlTemplateRequestedCallback({ relativeUrl, request })

          return serveFile(HTMLTemplateFileUrl, {
            headers: request.headers,
          })
        },
        () => {
          return serveBrowserSelfExecute({
            cancellationToken,
            logger,

            projectDirectoryUrl,
            browserSelfExecuteTemplateFileUrl,
            jsenvDirectoryRelativeUrl: compileServerJsenvDirectoryRelativeUrl,
            outDirectoryRelativeUrl,
            compileServerOrigin,
            compileServerImportMap,
            importDefaultExtension,

            projectFileRequestedCallback,
            request,
            babelPluginMap,
          })
        },
        () => {
          const relativeUrl = request.ressource.slice(1)
          const fileUrl = `${projectDirectoryUrl}${relativeUrl}`
          rawProjectFileRequestedCallback({ relativeUrl, request })
          return serveFile(fileUrl, {
            method: request.method,
            headers: request.headers,
            cacheStrategy: "etag",
          })
        },
      )

    const browserServer = await startServer({
      cancellationToken,
      logLevel,
      protocol,
      privateKey,
      certificate,
      ip,
      port,
      forcePort,
      sendInternalErrorStack: true,
      requestToResponse: service,
      accessControlAllowRequestOrigin: true,
      accessControlAllowRequestMethod: true,
      accessControlAllowRequestHeaders: true,
      accessControlAllowCredentials: true,
      keepProcessAlive,
    })

    compileServer.stoppedPromise.then(
      (reason) => {
        browserServer.stop(reason)
      },
      () => {},
    )

    return browserServer
  })
}
