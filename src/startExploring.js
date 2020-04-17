/* eslint-disable import/max-dependencies */
import { composeCancellationToken, createCancellationSource } from "@jsenv/cancellation"
import {
  catchCancellation,
  createCancellationTokenForProcess,
  metaMapToSpecifierMetaMap,
  normalizeSpecifierMetaMap,
  collectFiles,
  registerDirectoryLifecycle,
  resolveUrl,
  urlIsInsideOf,
  urlToRelativeUrl,
  assertFilePresence,
} from "@jsenv/util"
import {
  startServer,
  firstService,
  jsenvPrivateKey,
  jsenvCertificate,
  createSSERoom,
} from "@jsenv/server"
import { assertProjectDirectoryUrl, assertProjectDirectoryExists } from "./internal/argUtils.js"
import { serveExploring } from "./internal/exploring/serveExploring.js"
import { startCompileServer } from "./internal/compiling/startCompileServer.js"
import { jsenvHtmlFileUrl } from "./internal/jsenvHtmlFileUrl.js"
import { jsenvExplorableConfig } from "./jsenvExplorableConfig.js"

export const startExploring = async ({
  cancellationToken = createCancellationTokenForProcess(),
  logLevel = "info",
  compileServerLogLevel = "warn",
  apiServerLogLevel = "warn",

  htmlFileRelativeUrl,
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
  protocol = "https",
  privateKey = jsenvPrivateKey,
  certificate = jsenvCertificate,
  ip = "127.0.0.1",
  port = 0,
  compileServerPort = 0, // random available port
  apiServerPort = 0,
}) => {
  return catchCancellation(async () => {
    projectDirectoryUrl = assertProjectDirectoryUrl({ projectDirectoryUrl })
    await assertProjectDirectoryExists({ projectDirectoryUrl })

    if (typeof htmlFileRelativeUrl === "undefined") {
      htmlFileRelativeUrl = urlToRelativeUrl(jsenvHtmlFileUrl, projectDirectoryUrl)
    } else if (typeof htmlFileRelativeUrl !== "string") {
      throw new TypeError(`htmlFileRelativeUrl must be a string, received ${htmlFileRelativeUrl}`)
    }
    const htmlFileUrl = resolveUrl(htmlFileRelativeUrl, projectDirectoryUrl)
    // normalize htmlFileRelativeUrl
    htmlFileRelativeUrl = urlToRelativeUrl(htmlFileUrl, projectDirectoryUrl)
    await assertFilePresence(htmlFileUrl)

    const stopExploringCancellationSource = createCancellationSource()

    cancellationToken = composeCancellationToken(
      cancellationToken,
      stopExploringCancellationSource.token,
    )

    let livereloadServerSentEventService
    let projectFileRequestedCallback = () => {}

    if (livereloading) {
      const unregisterDirectoryLifecyle = registerDirectoryLifecycle(projectDirectoryUrl, {
        watchDescription: {
          ...watchConfig,
          [compileServer.jsenvDirectoryRelativeUrl]: false,
        },
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
        recursive: true,
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

      const trackExecutionDependency = (relativeUrl, executionId) => {
        if (dependencyTracker.hasOwnProperty(executionId)) {
          const dependencyArray = dependencyTracker[executionId]
          if (!dependencyArray.includes(relativeUrl)) {
            dependencyArray.push(relativeUrl)
          }
        } else {
          dependencyTracker[executionId] = [relativeUrl]
        }
      }

      const trackUnknown = (relativeUrl) => {
        // this file was requested but we don't know by which execution
        // let's make it a dependency of every execution we know
        Object.keys(dependencyTracker).forEach((executionId) => {
          trackExecutionDependency(executionId, relativeUrl)
        })
      }

      projectFileRequestedCallback = ({ relativeUrl, request }) => {
        projectFileSet.add(relativeUrl)

        const { headers = {} } = request

        if ("x-jsenv-execution-id" in headers) {
          trackExecutionDependency(headers["x-jsenv-execution-id"], relativeUrl)
        } else if ("referer" in headers) {
          const { origin } = request
          const { referer } = headers
          if (referer === origin || urlIsInsideOf(referer, origin)) {
            const refererRelativeUrl = urlToRelativeUrl(referer, origin)
            if (refererRelativeUrl) {
              Object.keys(dependencyTracker).forEach((executionId) => {
                if (
                  executionId === refererRelativeUrl ||
                  dependencyTracker[executionId].includes(refererRelativeUrl)
                ) {
                  trackExecutionDependency(executionId, relativeUrl)
                }
              })
            } else {
              trackUnknown(relativeUrl)
            }
          } else {
            trackUnknown(relativeUrl)
          }
        } else {
          trackUnknown(relativeUrl)
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
    } else {
      const emptyRoom = createSSERoom()
      emptyRoom.start()
      cancellationToken.register(emptyRoom.stop)
      livereloadServerSentEventService = () => {
        return emptyRoom.connect()
      }
    }

    const mandatoryParamsForServerToCommunicate = {
      protocol,
      privateKey,
      certificate,
      ip,
      cors: true,
    }

    const corsParams = {
      cors: true,
      accessControlAllowRequestOrigin: true,
      accessControlAllowRequestMethod: true,
      accessControlAllowRequestHeaders: true,
      accessControlAllowCredentials: true,
    }

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

      projectFileRequestedCallback: (value) => {
        // just to allow projectFileRequestedCallback to be redefined
        projectFileRequestedCallback(value)
      },
      stopOnPackageVersionChange: true,
      keepProcessAlive,

      compileServerProtocol: protocol,
      compileServerPrivateKey: privateKey,
      compileServerCertificate: certificate,
      compileServerIp: ip,
      compileServerPort,
      ...corsParams,
    })

    const {
      origin: compileServerOrigin,
      outDirectoryRelativeUrl,
      compileServerGroupMap,
    } = compileServer
    // to get a normalized importMapFileRelativeUrl
    importMapFileRelativeUrl = compileServer.importMapFileRelativeUrl

    const apiServer = await startServer({
      cancellationToken,
      logLevel: apiServerLogLevel,
      serverName: "api server",
      requestToResponse: (request) =>
        firstService(
          // eventsource
          () => {
            if (
              request.ressource === "/eventsource" &&
              request.headers &&
              request.headers.accept.includes("text/event-stream")
            ) {
              return livereloadServerSentEventService(request)
            }
            return null
          },
          // list explorable files
          async () => {
            if (request.ressource === "/explorables" && request.method === "POST") {
              const explorableConfig = JSON.parse(await readRequestBodyAsString(request.body))
              const specifierMetaMapRelativeForExplorable = metaMapToSpecifierMetaMap({
                explorable: explorableConfig,
              })
              const specifierMetaMapForExplorable = normalizeSpecifierMetaMap(
                specifierMetaMapRelativeForExplorable,
                projectDirectoryUrl,
              )
              const matchingFileResultArray = await collectFiles({
                directoryUrl: projectDirectoryUrl,
                specifierMetaMap: specifierMetaMapForExplorable,
                predicate: ({ explorable }) => explorable,
              })
              const explorableRelativeUrlArray = matchingFileResultArray.map(
                ({ relativeUrl }) => relativeUrl,
              )
              const json = JSON.stringify(explorableRelativeUrlArray)
              return {
                status: 200,
                headers: {
                  "cache-control": "no-store",
                  "content-type": "application/json",
                  "content-length": Buffer.byteLength(json),
                },
                body: json,
              }
            }
            return null
          },
        ),
      sendInternalErrorStack: true,
      keepProcessAlive,
      port: apiServerPort,
      ...mandatoryParamsForServerToCommunicate,
      ...corsParams,
    })

    const exploringServer = await startServer({
      cancellationToken,
      logLevel,
      serverName: "exploring server",
      requestToResponse: (request) => {
        return serveExploring(request, {
          projectDirectoryUrl,
          compileServerOrigin,
          outDirectoryRelativeUrl,
          compileServerGroupMap,
          htmlFileRelativeUrl,
          importMapFileRelativeUrl,
          apiServerOrigin: apiServer.origin,
          explorableConfig,
        })
      },
      sendInternalErrorStack: true,
      keepProcessAlive,
      port,
      ...mandatoryParamsForServerToCommunicate,
    })

    compileServer.stoppedPromise.then(
      (reason) => {
        exploringServer.stop(reason)
        apiServer.stop(reason)
      },
      () => {},
    )
    exploringServer.stoppedPromise.then((reason) => {
      stopExploringCancellationSource.cancel(reason)
    })
    apiServer.stoppedPromise.then((reason) => {
      stopExploringCancellationSource.cancel(reason)
    })

    return {
      exploringServer,
      compileServer,
      apiServer,
    }
  }).catch((e) => {
    process.exitCode = 1
    throw e
  })
}

const readRequestBodyAsString = (requestBody) => {
  return new Promise((resolve, reject) => {
    const bufferArray = []
    requestBody.subscribe({
      error: reject,
      next: (buffer) => {
        bufferArray.push(buffer)
      },
      complete: () => {
        const bodyAsBuffer = Buffer.concat(bufferArray)
        const bodyAsString = bodyAsBuffer.toString()
        resolve(bodyAsString)
      },
    })
  })
}
