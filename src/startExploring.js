/* eslint-disable import/max-dependencies */
import {
  catchAsyncFunctionCancellation,
  createCancellationTokenForProcessSIGINT,
  composeCancellationToken,
  createCancellationSource,
} from "@jsenv/cancellation"
import { metaMapToSpecifierMetaMap, normalizeSpecifierMetaMap, urlToMeta } from "@jsenv/url-meta"
import { startServer, firstService, serveFile, createSSERoom } from "@jsenv/server"
import { registerDirectoryLifecycle } from "@jsenv/file-watcher"
import { createLogger } from "@jsenv/logger"
import { resolveUrl, urlToFilePath, sameOrigin, urlToRelativeUrl } from "internal/urlUtils.js"
import { assertFileExists, writeFileContent } from "internal/filesystemUtils.js"
import { assertProjectDirectoryUrl, assertProjectDirectoryExists } from "internal/argUtils.js"
import { getBrowserExecutionDynamicData } from "internal/platform/getBrowserExecutionDynamicData.js"
import { serveExploringIndex } from "internal/exploring/serveExploringIndex.js"
import { serveBrowserSelfExecute } from "internal/exploring/serveBrowserSelfExecute.js"
import { startCompileServer } from "internal/compiling/startCompileServer.js"
import { jsenvHtmlFileUrl } from "internal/jsenvHtmlFileUrl.js"
import { jsenvExplorableConfig } from "./jsenvExplorableConfig.js"

export const startExploring = async ({
  cancellationToken = createCancellationTokenForProcessSIGINT(),
  logLevel,
  compileServerLogLevel = logLevel,

  htmlFileUrl = jsenvHtmlFileUrl,
  explorableConfig = jsenvExplorableConfig,
  livereloading = false,
  watchConfig = {
    "./**/*": true,
    "./**/.git/": false,
    "./**/node_modules/": false,
  },

  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importMapFileRelativeUrl,
  importDefaultExtension,

  babelPluginMap,
  convertMap,
  compileGroupCount = 2,

  keepProcessAlive = true,
  cors = true,
  protocol = "http",
  privateKey,
  certificate,
  ip = "127.0.0.1",
  port = 0,
  compileServerPort = 0, // random available port
  forcePort = false,
}) => {
  const logger = createLogger({ logLevel })

  projectDirectoryUrl = assertProjectDirectoryUrl({ projectDirectoryUrl })
  await assertProjectDirectoryExists({ projectDirectoryUrl })

  await assertFileExists(htmlFileUrl)

  const stopExploringCancellationSource = createCancellationSource()

  cancellationToken = composeCancellationToken(
    cancellationToken,
    stopExploringCancellationSource.token,
  )

  return catchAsyncFunctionCancellation(async () => {
    let livereloadServerSentEventService = () => {
      return {
        status: 204,
      }
    }
    let rawProjectFileRequestedCallback = () => {}
    let projectFileRequestedCallback = () => {}

    const compileServer = await startCompileServer({
      cancellationToken,
      compileServerLogLevel,

      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvDirectoryClean,
      importMapFileRelativeUrl,
      importDefaultExtension,

      compileGroupCount,
      babelPluginMap,
      convertMap,

      cors,
      protocol,
      privateKey,
      certificate,
      ip,
      port: compileServerPort,
      projectFileRequestedCallback: (value) => {
        // just to allow projectFileRequestedCallback to be redefined
        projectFileRequestedCallback(value)
      },
      stopOnPackageVersionChange: true,
      keepProcessAlive,
    })

    const specifierMetaMapRelativeForExplorable = metaMapToSpecifierMetaMap({
      explorable: explorableConfig,
    })
    const specifierMetaMapForExplorable = normalizeSpecifierMetaMap(
      specifierMetaMapRelativeForExplorable,
      projectDirectoryUrl,
    )

    if (livereloading) {
      const unregisterDirectoryLifecyle = registerDirectoryLifecycle(
        urlToFilePath(projectDirectoryUrl),
        {
          watchDescription: {
            ...watchConfig,
            [compileServer.jsenvDirectoryRelativeUrl]: false,
          },
          updated: ({ relativePath: relativeUrl }) => {
            if (projectFileSet.has(relativeUrl)) {
              projectFileUpdatedCallback(relativeUrl)
            }
          },
          removed: ({ relativePath: relativeUrl }) => {
            if (projectFileSet.has(relativeUrl)) {
              projectFileSet.delete(relativeUrl)
              projectFileRemovedCallback(relativeUrl)
            }
          },
          keepProcessAlive: false,
        },
      )
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
        // when it's the html file used to execute the files
        if (relativeUrl === urlToRelativeUrl(htmlFileUrl, projectDirectoryUrl)) {
          dependencyTracker[relativeUrl] = []
        } else {
          projectFileRequestedCallback({ relativeUrl, request })
          projectFileSet.add(relativeUrl)
        }
      }

      livereloadServerSentEventService = ({ request: { ressource, headers } }) => {
        return getOrCreateRoomForRelativeUrl(ressource.slice(1)).connect(headers["last-event-id"])
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

    const {
      origin: compileServerOrigin,
      compileServerImportMap,
      outDirectoryRelativeUrl,
      jsenvDirectoryRelativeUrl: compileServerJsenvDirectoryRelativeUrl,
    } = compileServer

    // dynamic data exists only to retrieve the compile server origin
    // that can be dynamic
    // otherwise the cached bundles would still target the previous compile server origin
    const jsenvDirectoryUrl = resolveUrl(
      compileServerJsenvDirectoryRelativeUrl,
      projectDirectoryUrl,
    )
    const browserDynamicDataFileUrl = resolveUrl(
      "./browser-execute-dynamic-data.json",
      jsenvDirectoryUrl,
    )
    await writeFileContent(
      urlToFilePath(browserDynamicDataFileUrl),
      JSON.stringify(
        getBrowserExecutionDynamicData({ projectDirectoryUrl, compileServerOrigin }),
        null,
        "  ",
      ),
    )

    const service = (request) =>
      firstService(
        () => {
          const { accept = "" } = request.headers
          if (accept.includes("text/event-stream")) {
            return livereloadServerSentEventService({ request })
          }
          return null
        },
        () => {
          if (request.ressource === "/") {
            return serveExploringIndex({
              projectDirectoryUrl,
              htmlFileUrl,
              explorableConfig,
              request,
            })
          }
          return null
        },
        () => {
          return serveBrowserSelfExecute({
            cancellationToken,
            logger,

            projectDirectoryUrl,
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

    const exploringServer = await startServer({
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
        exploringServer.stop(reason)
      },
      () => {},
    )
    exploringServer.stoppedPromise.then((reason) => {
      stopExploringCancellationSource.cancel(reason)
    })

    return {
      exploringServer,
      compileServer,
    }
  })
}
