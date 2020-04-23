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
import { createLogger } from "@jsenv/logger"
import {
  startServer,
  firstService,
  jsenvPrivateKey,
  jsenvCertificate,
  createSSERoom,
  readRequestBodyAsString,
} from "@jsenv/server"
import { assertProjectDirectoryUrl, assertProjectDirectoryExists } from "./internal/argUtils.js"
import { getBrowserExecutionDynamicData } from "./internal/runtime/getBrowserExecutionDynamicData.js"
import { serveExploring } from "./internal/exploring/serveExploring.js"
import { startCompileServer } from "./internal/compiling/startCompileServer.js"
import { jsenvHtmlFileUrl } from "./internal/jsenvHtmlFileUrl.js"
import { jsenvExplorableConfig } from "./jsenvExplorableConfig.js"

export const startExploring = async ({
  cancellationToken = createCancellationTokenForProcess(),
  logLevel = "info",
  compileServerLogLevel = "warn",
  trackingLogLevel = "warn",

  htmlFileRelativeUrl,
  explorableConfig = jsenvExplorableConfig,
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
}) => {
  return catchCancellation(async () => {
    const trackingLogger = createLogger({ logLevel: trackingLogLevel })
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

    const roomSet = new Set()
    const trackerSet = new Set()
    const projectFileRequested = createCallbackList()
    const projectFileUpdated = createCallbackList()
    const projectFileRemoved = createCallbackList()

    const livereloadServerSentEventService = (request) => {
      const { accept } = request.headers
      if (!accept || !accept.includes("text/event-stream")) return null

      const room = createSSERoom()
      roomSet.add(room)
      room.start()

      const entryFileRelativeUrl = request.ressource.slice(1)
      trackingLogger.info(`track ${entryFileRelativeUrl}`)
      const disconnectRoomFromFileChanges = connectRoomWithFileChanges(room, entryFileRelativeUrl)

      cancellationToken.register(room.stop)
      // request.cancellationToken occurs when request is aborted
      // maybe I should update @jsenv/server to occur also when request connection is closed
      // https://nodejs.org/api/http.html#http_event_close_2
      request.cancellationToken.register(() => {
        trackingLogger.info(`stop tracking ${entryFileRelativeUrl}`)
        disconnectRoomFromFileChanges()
        roomSet.delete(room)
        room.stop()
      })
      return room.connect(request.headers["last-event-id"])
    }

    const connectRoomWithFileChanges = (room, mainRelativeUrl) => {
      // setTimeout(() => {
      //   room.sendEvent({
      //     type: "file-changed",
      //     data: "whatever",
      //   })
      // }, 200)

      const dependencySet = new Set()
      // mainRelativeUrl and htmlFileRelativeUrl will be detected by projectFileRequestedCallback

      const tracker = { mainRelativeUrl, dependencySet }
      trackerSet.add(tracker)

      const unregisterProjectFileRequestedCallback = projectFileRequested.register(
        (relativeUrl, request) => {
          const dependencyReport = reportDependency({
            trackingLogger,
            relativeUrl,
            request,
            mainRelativeUrl,
            trackerSet,
          })
          if (dependencyReport.dependency === false) {
            trackingLogger.debug(
              `${relativeUrl} not a dependency of ${mainRelativeUrl} because ${dependencyReport.reason}`,
            )
          } else if (!dependencySet.has(relativeUrl)) {
            trackingLogger.debug(
              `${relativeUrl} is a dependency of ${mainRelativeUrl} because ${dependencyReport.reason}`,
            )
            dependencySet.add(relativeUrl)
          }
        },
      )
      const unregisterProjectFileUpdatedCallback = projectFileUpdated.register((relativeUrl) => {
        if (dependencySet.has(relativeUrl)) {
          room.sendEvent({
            type: "file-changed",
            data: relativeUrl,
          })
        }
      })
      const unregisterProjectFileRemovedCallback = projectFileRemoved.register((relativeUrl) => {
        if (dependencySet.has(relativeUrl)) {
          room.sendEvent({
            type: "file-removed",
            data: relativeUrl,
          })
        }
      })

      return () => {
        trackerSet.delete(tracker)
        unregisterProjectFileRequestedCallback()
        unregisterProjectFileUpdatedCallback()
        unregisterProjectFileRemovedCallback()
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

      projectFileRequestedCallback: projectFileRequested.notify,
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

    // NOTE: if exploring server port is taken
    // compileServer remains listening
    const exploringServer = await startServer({
      cancellationToken,
      logLevel,
      serverName: "exploring server",
      requestToResponse: (request) =>
        firstService(
          // get important info
          () => {
            if (
              request.ressource === "/exploring.json" &&
              request.method === "GET" &&
              "x-jsenv-exploring" in request.headers
            ) {
              const {
                browserRuntimeFileRelativeUrl,
                sourcemapMainFileRelativeUrl,
                sourcemapMappingFileRelativeUrl,
              } = getBrowserExecutionDynamicData({ projectDirectoryUrl, compileServerOrigin })

              const data = {
                projectDirectoryUrl,
                compileServerOrigin,
                outDirectoryRelativeUrl,
                htmlFileRelativeUrl,
                browserRuntimeFileRelativeUrl,
                sourcemapMainFileRelativeUrl,
                sourcemapMappingFileRelativeUrl,
                explorableConfig,
              }
              const json = JSON.stringify(data)
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
          // list explorable files
          async () => {
            if (
              request.ressource === "/explorables" &&
              request.method === "POST" &&
              "x-jsenv-exploring" in request.headers
            ) {
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
          // eventsource
          () => {
            return livereloadServerSentEventService(request)
          },
          // exploring single page app
          () => {
            return serveExploring(request, {
              projectDirectoryUrl,
              compileServerOrigin,
              outDirectoryRelativeUrl,
              compileServerGroupMap,
              htmlFileRelativeUrl,
              importMapFileRelativeUrl,
              explorableConfig,
            })
          },
        ),
      sendInternalErrorStack: true,
      keepProcessAlive,
      port,
      ...mandatoryParamsForServerToCommunicate,
    })

    const unregisterDirectoryLifecyle = registerDirectoryLifecycle(projectDirectoryUrl, {
      watchDescription: {
        ...watchConfig,
        [compileServer.jsenvDirectoryRelativeUrl]: false,
      },
      updated: ({ relativeUrl }) => {
        projectFileUpdated.notify(relativeUrl)
      },
      removed: ({ relativeUrl }) => {
        projectFileRemoved.notify(relativeUrl)
      },
      keepProcessAlive: false,
      recursive: true,
    })
    cancellationToken.register(unregisterDirectoryLifecyle)

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
  }).catch((e) => {
    process.exitCode = 1
    throw e
  })
}

const createCallbackList = () => {
  const callbackSet = new Set()

  const register = (callback) => {
    callbackSet.add(callback)
    return () => {
      callbackSet.delete(callback)
    }
  }

  const notify = (...args) => {
    callbackSet.forEach((callback) => {
      callback(...args)
    })
  }

  return {
    register,
    notify,
  }
}

const reportDependency = ({ relativeUrl, mainRelativeUrl, request, trackerSet }) => {
  if (relativeUrl === mainRelativeUrl) {
    return {
      dependency: true,
      reason: "it's main",
    }
  }

  if (relativeUrlToMainRelativeUrl(relativeUrl) === mainRelativeUrl) {
    return {
      dependnecy: true,
      reason: "it's html template",
    }
  }

  if ("x-jsenv-execution-id" in request.headers) {
    const executionId = request.headers["x-jsenv-execution-id"]
    if (executionId === mainRelativeUrl) {
      return {
        dependency: true,
        reason: "x-jsenv-execution-id request header",
      }
    }
    return {
      dependency: false,
      reason: "x-jsenv-execution-id request header",
    }
  }

  if ("referer" in request.headers) {
    const { origin } = request
    const { referer } = request.headers
    // referer is likely the exploringServer
    if (referer !== origin && !urlIsInsideOf(referer, origin)) {
      return {
        dependency: false,
        reason: "referer is an other origin",
      }
    }
    // here we know the referer is inside compileServer
    const refererRelativeUrl = urlToRelativeUrl(referer, origin)
    if (refererRelativeUrl) {
      const mainRelativeUrlCandidate = relativeUrlToMainRelativeUrl(refererRelativeUrl)
      if (mainRelativeUrlCandidate) {
        // referer looks like **/*.html?file=*
        if (mainRelativeUrlCandidate === mainRelativeUrl) {
          return {
            dependency: true,
            reason: "referer main file is the same",
          }
        }
        return {
          dependency: false,
          reason: "referer main file is different",
        }
      }

      // search if referer (file requesting this one) is tracked as being a dependency of main file
      // in that case because the importer is a dependency the importee is also a dependency
      // eslint-disable-next-line no-unused-vars
      for (const tracker of trackerSet) {
        if (
          tracker.mainRelativeUrl === mainRelativeUrl &&
          tracker.dependencySet.has(refererRelativeUrl)
        ) {
          return {
            dependency: true,
            reason: "referer is a dependency",
          }
        }
      }
    }
  }

  return {
    dependency: true,
    reason: "it was requested",
  }
}

const relativeUrlToMainRelativeUrl = (relativeUrl) => {
  const url = new URL(relativeUrl, "file:///directory/")
  const { pathname } = url
  if (!pathname.endsWith(`.html`)) {
    return null
  }
  const { searchParams } = url
  if (searchParams.has("file")) {
    return searchParams.get("file")
  }
  return null
}
