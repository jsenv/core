/* eslint-disable import/max-dependencies */
import {
  catchAsyncFunctionCancellation,
  createCancellationTokenForProcessSIGINT,
} from "@jsenv/cancellation"
import { metaMapToSpecifierMetaMap, normalizeSpecifierMetaMap, urlToMeta } from "@jsenv/url-meta"
import { startServer, firstService, serveFile, createSSERoom } from "@jsenv/server"
import { registerDirectoryLifecycle } from "@jsenv/file-watcher"
import { createLogger } from "@jsenv/logger"
import { pathToDirectoryUrl, resolveDirectoryUrl, resolveFileUrl } from "internal/urlUtils.js"
import { assertFileExists } from "internal/filesystemUtils.js"
import {
  assertProjectDirectoryPath,
  assertProjectDirectoryExists,
  assertImportMapFileRelativePath,
  assertImportMapFileInsideProject,
  assertCompileDirectoryRelativePath,
  assertCompileDirectoryInsideProject,
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
    "./src/internal/exploring/browser-self-execute-template.js",
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
  compileDirectoryRelativeUrl = "./.dist",
  compileDirectoryClean,
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

  assertImportMapFileRelativePath({ importMapFileRelativeUrl })
  const importMapFileUrl = resolveFileUrl(importMapFileRelativeUrl, projectDirectoryUrl)
  assertImportMapFileInsideProject({ importMapFileUrl, projectDirectoryUrl })

  assertCompileDirectoryRelativePath({ compileDirectoryRelativeUrl })
  const compileDirectoryUrl = resolveDirectoryUrl(compileDirectoryRelativeUrl, projectDirectoryUrl)
  assertCompileDirectoryInsideProject({ compileDirectoryUrl, projectDirectoryUrl })

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
        updated: ({ relativePath }) => {
          if (projectFileSet.has(relativePath)) {
            projectFileUpdatedCallback(relativePath)
          }
        },
        removed: ({ relativePath }) => {
          if (projectFileSet.has(relativePath)) {
            projectFileSet.delete(relativePath)
            projectFileRemovedCallback(relativePath)
          }
        },
        keepProcessAlive: false,
      })
      cancellationToken.register(unregisterDirectoryLifecyle)

      const projectFileSet = new Set()
      const roomMap = {}
      const dependencyTracker = {}

      const projectFileUpdatedCallback = (relativePath) => {
        projectFileToAffectedRoomArray(relativePath).forEach((room) => {
          room.sendEvent({
            type: "file-changed",
            data: relativePath,
          })
        })
      }

      const projectFileRemovedCallback = (relativePath) => {
        projectFileToAffectedRoomArray(relativePath).forEach((room) => {
          room.sendEvent({
            type: "file-removed",
            data: relativePath,
          })
        })
      }

      const projectFileToAffectedRoomArray = (relativePath) => {
        const affectedRoomArray = []
        Object.keys(roomMap).forEach((mainRelativePath) => {
          if (!dependencyTracker.hasOwnProperty(mainRelativePath)) return

          if (
            relativePath === mainRelativePath ||
            dependencyTracker[mainRelativePath].includes(relativePath)
          ) {
            affectedRoomArray.push(roomMap[mainRelativePath])
          }
        })
        return affectedRoomArray
      }

      const trackDependency = ({ relativePath, executionId }) => {
        if (executionId) {
          // quand on voit main on marque tout ce qui existe actuallement
          // comme plus dépendant ?
          // mais si ce qui était la

          if (dependencyTracker.hasOwnProperty(executionId)) {
            const dependencyArray = dependencyTracker[executionId]
            if (!dependencyArray.includes(dependencyTracker)) {
              dependencyArray.push(relativePath)
            }
          } else {
            dependencyTracker[executionId] = [relativePath]
          }
        } else {
          Object.keys(dependencyTracker).forEach((executionId) => {
            trackDependency({ relativePath, executionId })
          })
        }
      }

      htmlTemplateRequestedCallback = ({ relativePath }) => {
        dependencyTracker[relativePath] = []
      }

      projectFileRequestedCallback = ({ relativePath, request }) => {
        projectFileSet.add(relativePath)

        const { headers = {} } = request

        if ("x-jsenv-execution-id" in headers) {
          const executionId = headers["x-jsenv-execution-id"]
          trackDependency({ relativePath, executionId })
        } else if ("referer" in headers) {
          const { referer } = headers
          if (sameOrigin(referer, request.origin)) {
            const refererRelativePath = urlToRelativePath(referer)
            const refererFileUrl = `${projectDirectoryUrl}${refererRelativePath}`

            if (
              urlToMeta({
                url: refererFileUrl,
                specifierMetaMap: specifierMetaMapForExplorable,
              }).explorable
            ) {
              const executionId = refererRelativePath
              trackDependency({
                relativePath,
                executionId,
              })
            } else {
              Object.keys(dependencyTracker).forEach((executionId) => {
                if (
                  executionId === refererRelativePath ||
                  dependencyTracker[executionId].includes(refererRelativePath)
                ) {
                  trackDependency({
                    relativePath,
                    executionId,
                  })
                }
              })
            }
          } else {
            trackDependency({ relativePath })
          }
        } else {
          trackDependency({ relativePath })
        }
      }

      rawProjectFileRequestedCallback = ({ relativePath, request }) => {
        projectFileRequestedCallback({ relativePath, request })
        projectFileSet.add(relativePath)
      }

      livereloadServerSentEventService = ({ relativePath, request }) => {
        const { accept = "" } = request.headers
        if (!accept.includes("text/event-stream")) return null

        return getOrCreateRoomForRelativePath(relativePath).connect(
          request.headers["last-event-id"],
        )
      }

      const getOrCreateRoomForRelativePath = (relativePath) => {
        if (roomMap.hasOwnProperty(relativePath)) return roomMap[relativePath]

        const room = createSSERoom()
        room.start()
        cancellationToken.register(room.stop)
        roomMap[relativePath] = room
        return room
      }
    }

    const compileServer = await startCompileServer({
      cancellationToken,
      logLevel: compileServerLogLevel,
      projectDirectoryUrl,
      compileDirectoryUrl,
      compileDirectoryClean,
      importMapFileUrl,
      importDefaultExtension,
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

    const { origin: compileServerOrigin } = compileServer

    const logger = createLogger({ logLevel })

    const service = (request) =>
      firstService(
        () => {
          const requestServerUrl = `${request.origin}${request.ressource}`
          const relativePath = urlToRelativePath(requestServerUrl)
          return livereloadServerSentEventService({
            relativePath,
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
          const relativePath = request.ressource.slice(1)
          const requestFileUrl = `${projectDirectoryUrl}${relativePath}`

          if (
            !urlToMeta({
              url: requestFileUrl,
              specifierMetaMap: specifierMetaMapForExplorable,
            }).explorable
          ) {
            return null
          }

          htmlTemplateRequestedCallback({ relativePath, request })

          return serveFile(HTMLTemplateFileUrl, {
            headers: request.headers,
          })
        },
        () => {
          return serveBrowserSelfExecute({
            logger,
            compileServerOrigin,
            projectDirectoryUrl,
            compileDirectoryUrl,
            importMapFileUrl,
            importDefaultExtension,
            browserSelfExecuteTemplateFileUrl,
            babelPluginMap,
            request,
            livereloading,
          })
        },
        () => {
          const requestServerUrl = `${request.origin}${request.ressource}`
          const relativePath = urlToRelativePath(requestServerUrl)
          rawProjectFileRequestedCallback({ relativePath, request })
          return serveFile(`${projectDirectoryUrl}${relativePath}`, {
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

const sameOrigin = (url, otherUrl) => {
  return new URL(url).origin === new URL(otherUrl).origin
}

const urlToRelativePath = (url) => {
  return new URL(url).pathname.slice(1)
}
