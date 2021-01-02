/* eslint-disable import/max-dependencies */
import { readFileSync } from "fs"
import {
  createCancellationToken,
  createCancellationSource,
  composeCancellationToken,
} from "@jsenv/cancellation"
import {
  jsenvAccessControlAllowedHeaders,
  startServer,
  serveFile,
  createSSERoom,
  firstServiceWithTiming,
} from "@jsenv/server"
import { createLogger, createDetailedMessage } from "@jsenv/logger"
import {
  resolveUrl,
  urlToFileSystemPath,
  urlToRelativeUrl,
  resolveDirectoryUrl,
  readFile,
  writeFile,
  removeFileSystemNode,
  ensureEmptyDirectory,
  registerFileLifecycle,
  registerDirectoryLifecycle,
  urlIsInsideOf,
} from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"
import { assertImportMapFileRelativeUrl, assertImportMapFileInsideProject } from "../argUtils.js"
import { babelPluginReplaceExpressions } from "../babel-plugin-replace-expressions.js"
import { generateGroupMap } from "../generateGroupMap/generateGroupMap.js"
import { jsenvBabelPluginCompatMap } from "../../jsenvBabelPluginCompatMap.js"
import { jsenvBrowserScoreMap } from "../../jsenvBrowserScoreMap.js"
import { jsenvNodeVersionScoreMap } from "../../jsenvNodeVersionScoreMap.js"
import { jsenvBabelPluginMap } from "../../jsenvBabelPluginMap.js"
import { createCallbackList } from "../createCallbackList.js"
import { createCompiledFileService } from "./createCompiledFileService.js"
import { urlIsCompilationAsset } from "./compile-directory/compile-asset.js"
import { sourcemapMainFileUrl, sourcemapMappingFileUrl } from "../jsenvInternalFiles.js"

export const startCompileServer = async ({
  cancellationToken = createCancellationToken(),
  compileServerLogLevel,

  projectDirectoryUrl,
  importMapFileRelativeUrl = "import-map.importmap",
  importDefaultExtension,
  importMetaDev = false,
  importMetaEnvFileRelativeUrl,
  importMeta = {},
  jsenvDirectoryRelativeUrl = ".jsenv",
  jsenvDirectoryClean = false,
  outDirectoryName = "out",

  writeOnFilesystem = true,
  sourcemapExcludeSources = false, // this should increase perf (no need to download source for browser)
  useFilesystemAsCache = true,
  compileCacheStrategy = "etag",
  projectFileEtagEnabled = true,

  // js compile options
  transformTopLevelAwait = true,
  moduleOutFormat = "systemjs",
  importMetaFormat = moduleOutFormat,
  env = {},
  processEnvNodeEnv = process.env.NODE_ENV,
  replaceProcessEnvNodeEnv = true,
  replaceGlobalObject = false,
  replaceGlobalFilename = false,
  replaceGlobalDirname = false,
  replaceMap = {},
  babelPluginMap = jsenvBabelPluginMap,
  convertMap = {},
  customCompilers = [],

  // options related to the server itself
  compileServerProtocol = "https",
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp = "0.0.0.0",
  compileServerPort = 0,
  keepProcessAlive = false,
  stopOnPackageVersionChange = false,

  // remaining options
  compileGroupCount = 1,
  babelCompatMap = jsenvBabelPluginCompatMap,
  browserScoreMap = jsenvBrowserScoreMap,
  nodeVersionScoreMap = jsenvNodeVersionScoreMap,
  runtimeAlwaysInsideRuntimeScoreMap = false,

  livereloadWatchConfig = {
    "./**": true,
    "./**/.*/": false, // any folder starting with a dot is ignored (includes .git for instance)
    "./dist/": false,
    "./**/node_modules/": false,
  },
  livereloadLogLevel = "info",
  customServices = {},
  livereloadSSE = false,
  scriptInjections = [],
}) => {
  assertArguments({
    projectDirectoryUrl,
    importMapFileRelativeUrl,
    jsenvDirectoryRelativeUrl,
    outDirectoryName,
  })

  const importMapFileUrl = resolveUrl(importMapFileRelativeUrl, projectDirectoryUrl)
  const jsenvDirectoryUrl = resolveDirectoryUrl(jsenvDirectoryRelativeUrl, projectDirectoryUrl)
  const outDirectoryUrl = resolveDirectoryUrl(outDirectoryName, jsenvDirectoryUrl)
  const outDirectoryRelativeUrl = urlToRelativeUrl(outDirectoryUrl, projectDirectoryUrl)
  // normalization
  importMapFileRelativeUrl = urlToRelativeUrl(importMapFileUrl, projectDirectoryUrl)
  jsenvDirectoryRelativeUrl = urlToRelativeUrl(jsenvDirectoryUrl, projectDirectoryUrl)

  const logger = createLogger({ logLevel: compileServerLogLevel })
  babelPluginMap = {
    "transform-replace-expressions": [
      babelPluginReplaceExpressions,
      {
        replaceMap: {
          ...(replaceProcessEnvNodeEnv
            ? { "process.env.NODE_ENV": `("${processEnvNodeEnv}")` }
            : {}),
          ...(replaceGlobalObject ? { global: "globalThis" } : {}),
          ...(replaceGlobalFilename ? { __filename: __filenameReplacement } : {}),
          ...(replaceGlobalDirname ? { __dirname: __dirnameReplacement } : {}),
          ...replaceMap,
        },
        allowConflictingReplacements: true,
      },
    ],
    ...babelPluginMap,
  }
  const compileServerGroupMap = generateGroupMap({
    babelPluginMap,
    babelCompatMap,
    runtimeScoreMap: { ...browserScoreMap, node: nodeVersionScoreMap },
    groupCount: compileGroupCount,
    runtimeAlwaysInsideRuntimeScoreMap,
  })

  importMeta = {
    dev: importMetaDev,
    ...importMeta,
  }

  await setupOutDirectory(outDirectoryUrl, {
    logger,
    jsenvDirectoryUrl,
    jsenvDirectoryClean,
    useFilesystemAsCache,
    babelPluginMap,
    convertMap,
    importMeta,
    importMetaEnvFileRelativeUrl,
    compileServerGroupMap,
  })

  const serverStopCancellationSource = createCancellationSource()

  let projectFileRequestedCallback = () => {}
  if (livereloadSSE) {
    const sseSetup = setupServerSentEventsForLivereload({
      cancellationToken: composeCancellationToken(
        cancellationToken,
        serverStopCancellationSource.token,
      ),
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      outDirectoryRelativeUrl,
      livereloadLogLevel,
      livereloadWatchConfig,
    })

    projectFileRequestedCallback = sseSetup.projectFileRequestedCallback
    const serveSSEForLivereload = createSSEForLivereloadService({
      cancellationToken,
      outDirectoryRelativeUrl,
      trackMainAndDependencies: sseSetup.trackMainAndDependencies,
    })
    customServices = {
      "service:livereload sse": serveSSEForLivereload,
      ...customServices,
    }
  }

  const serveCompilationAssetFile = createCompilationAssetFileService({ projectDirectoryUrl })
  const serveBrowserScript = createBrowserScriptService({
    projectDirectoryUrl,
    outDirectoryRelativeUrl,
  })
  const serveCompiledFile = createCompiledFileService({
    cancellationToken,
    logger,

    projectDirectoryUrl,
    outDirectoryRelativeUrl,
    jsenvDirectoryRelativeUrl,
    importMapFileRelativeUrl,
    importDefaultExtension,
    importMetaEnvFileRelativeUrl,
    importMeta,

    transformTopLevelAwait,
    groupMap: compileServerGroupMap,
    babelPluginMap,
    convertMap,
    customCompilers,
    moduleOutFormat,
    importMetaFormat,
    scriptInjections,

    projectFileRequestedCallback,
    useFilesystemAsCache,
    writeOnFilesystem,
    sourcemapExcludeSources,
    compileCacheStrategy,
  })
  const serveProjectFile = createProjectFileService({
    projectDirectoryUrl,
    projectFileRequestedCallback,
    projectFileEtagEnabled,
  })

  const compileServer = await startServer({
    cancellationToken,
    logLevel: compileServerLogLevel,

    protocol: compileServerProtocol,
    http2: compileServerProtocol === "https",
    privateKey: compileServerPrivateKey,
    certificate: compileServerCertificate,
    ip: compileServerIp,
    port: compileServerPort,
    sendServerTiming: true,
    nagle: false,
    sendServerInternalErrorDetails: true,
    requestToResponse: firstServiceWithTiming({
      ...customServices,
      "service:compilation asset": serveCompilationAssetFile,
      "service:browser script": serveBrowserScript,
      "service:compiled file": serveCompiledFile,
      "service:project file": serveProjectFile,
    }),
    accessControlAllowRequestOrigin: true,
    accessControlAllowRequestMethod: true,
    accessControlAllowRequestHeaders: true,
    accessControlAllowedRequestHeaders: [
      ...jsenvAccessControlAllowedHeaders,
      "x-jsenv-execution-id",
    ],
    accessControlAllowCredentials: true,
    keepProcessAlive,
  })

  compileServer.stoppedPromise.then(serverStopCancellationSource.cancel)

  const uninstallOutFiles = await installOutFiles({
    logger,
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    importDefaultExtension,
    importMapFileRelativeUrl,
    compileServerGroupMap,
    env,
    writeOnFilesystem,
    onOutFileWritten: (outFileUrl) => {
      logger.debug(`-> ${outFileUrl}`)
    },
  })
  if (!writeOnFilesystem) {
    compileServer.stoppedPromise.then(() => {
      uninstallOutFiles()
    })
  }

  if (stopOnPackageVersionChange) {
    const stopListeningJsenvPackageVersionChange = listenJsenvPackageVersionChange({
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      onJsenvPackageVersionChange: () => {
        compileServer.stop(STOP_REASON_PACKAGE_VERSION_CHANGED)
      },
    })
    compileServer.stoppedPromise.then(
      () => {
        stopListeningJsenvPackageVersionChange()
      },
      () => {},
    )
  }

  return {
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    importMapFileRelativeUrl,
    ...compileServer,
    compileServerGroupMap,
  }
}

export const computeOutDirectoryRelativeUrl = ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl = ".jsenv",
  outDirectoryName = "out",
}) => {
  const jsenvDirectoryUrl = resolveDirectoryUrl(jsenvDirectoryRelativeUrl, projectDirectoryUrl)
  const outDirectoryUrl = resolveDirectoryUrl(outDirectoryName, jsenvDirectoryUrl)
  const outDirectoryRelativeUrl = urlToRelativeUrl(outDirectoryUrl, projectDirectoryUrl)

  return outDirectoryRelativeUrl
}

const assertArguments = ({
  projectDirectoryUrl,
  importMapFileRelativeUrl,
  jsenvDirectoryRelativeUrl,
  outDirectoryName,
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string. got ${projectDirectoryUrl}`)
  }

  assertImportMapFileRelativeUrl({ importMapFileRelativeUrl })
  const importMapFileUrl = resolveUrl(importMapFileRelativeUrl, projectDirectoryUrl)
  assertImportMapFileInsideProject({ importMapFileUrl, projectDirectoryUrl })

  if (typeof jsenvDirectoryRelativeUrl !== "string") {
    throw new TypeError(
      `jsenvDirectoryRelativeUrl must be a string. got ${jsenvDirectoryRelativeUrl}`,
    )
  }
  const jsenvDirectoryUrl = resolveDirectoryUrl(jsenvDirectoryRelativeUrl, projectDirectoryUrl)

  if (!jsenvDirectoryUrl.startsWith(projectDirectoryUrl)) {
    throw new TypeError(
      createDetailedMessage(`jsenv directory must be inside project directory`, {
        ["jsenv directory url"]: jsenvDirectoryUrl,
        ["project directory url"]: projectDirectoryUrl,
      }),
    )
  }

  if (typeof outDirectoryName !== "string") {
    throw new TypeError(`outDirectoryName must be a string. got ${outDirectoryName}`)
  }
}

const setupOutDirectory = async (
  outDirectoryUrl,
  {
    logger,
    jsenvDirectoryClean,
    jsenvDirectoryUrl,
    useFilesystemAsCache,
    babelPluginMap,
    convertMap,
    importMeta,
    importMetaEnvFileRelativeUrl,
    compileServerGroupMap,
    replaceProcessEnvNodeEnv,
    processEnvNodeEnv,
  },
) => {
  if (jsenvDirectoryClean) {
    logger.info(`Cleaning jsenv directory because jsenvDirectoryClean parameter enabled`)
    await ensureEmptyDirectory(jsenvDirectoryUrl)
  }
  if (useFilesystemAsCache) {
    const jsenvCorePackageFileUrl = resolveUrl("./package.json", jsenvCoreDirectoryUrl)
    const jsenvCorePackageFilePath = urlToFileSystemPath(jsenvCorePackageFileUrl)
    const jsenvCorePackageVersion = readPackage(jsenvCorePackageFilePath).version
    const outDirectoryMeta = {
      jsenvCorePackageVersion,
      babelPluginMap,
      convertMap,
      importMeta,
      importMetaEnvFileRelativeUrl,
      compileServerGroupMap,
      replaceProcessEnvNodeEnv,
      processEnvNodeEnv,
    }
    const metaFileUrl = resolveUrl("./meta.json", outDirectoryUrl)

    let previousOutDirectoryMeta
    try {
      const source = await readFile(metaFileUrl)
      previousOutDirectoryMeta = JSON.parse(source)
    } catch (e) {
      if (e && e.code === "ENOENT") {
        previousOutDirectoryMeta = null
      } else {
        throw e
      }
    }

    if (previousOutDirectoryMeta !== null) {
      const outDirectoryChanges = getOutDirectoryChanges(previousOutDirectoryMeta, outDirectoryMeta)

      if (outDirectoryChanges) {
        if (!jsenvDirectoryClean) {
          logger.warn(
            createDetailedMessage(
              `Cleaning jsenv out directory because configuration has changed.`,
              {
                "changes": outDirectoryChanges.namedChanges
                  ? outDirectoryChanges.namedChanges
                  : `something`,
                "out directory": urlToFileSystemPath(outDirectoryUrl),
              },
            ),
          )
        }
        await ensureEmptyDirectory(outDirectoryUrl)
      }
    }

    await writeFile(metaFileUrl, JSON.stringify(outDirectoryMeta, null, "  "))
  }
}

const getOutDirectoryChanges = (previousOutDirectoryMeta, outDirectoryMeta) => {
  const changes = Object.keys(outDirectoryMeta).filter((key) => {
    const now = outDirectoryMeta[key]
    const previous = previousOutDirectoryMeta[key]
    return !compareValueJson(now, previous)
  })

  if (changes.length > 0) {
    return { namedChanges: changes }
  }

  // in case basic comparison from above is not enough
  if (!compareValueJson(previousOutDirectoryMeta, outDirectoryMeta)) {
    return { somethingChanged: true }
  }

  return null
}

const compareValueJson = (left, right) => {
  return JSON.stringify(left) === JSON.stringify(right)
}

// eslint-disable-next-line valid-jsdoc
/**
 * We need to get two things:
 * { projectFileRequestedCallback, trackMainAndDependencies }
 *
 * projectFileRequestedCallback
 * This function will be called by the compile server every time a file inside projectDirectory
 * is requested so that we can build up the dependency tree of any file
 *
 * trackMainAndDependencies
 * This function is meant to be used to implement server sent events in order for a client to know
 * when a given file or any of its dependencies changes in order to implement livereloading.
 * At any time this function can be called with (mainRelativeUrl, { modified, removed, lastEventId })
 * modified is called
 *  - immediatly if lastEventId is passed and mainRelativeUrl or any of its dependencies have
 *  changed since that event (last change is passed to modified if their is more than one change)
 *  - when mainRelativeUrl or any of its dependencies is modified
 * removed is called
 *  - with same spec as modified but when a file is deleted from the filesystem instead of modified
 *
 */
const setupServerSentEventsForLivereload = ({
  cancellationToken,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  outDirectoryRelativeUrl,
  livereloadLogLevel,
  livereloadWatchConfig,
}) => {
  const livereloadLogger = createLogger({ logLevel: livereloadLogLevel })
  const trackerMap = new Map()
  const projectFileRequested = createCallbackList()
  const projectFileModified = createCallbackList()
  const projectFileRemoved = createCallbackList()
  const projectFileAdded = createCallbackList()

  const projectFileRequestedCallback = (relativeUrl, request) => {
    // I doubt a compilation asset like .js.map will change
    // in theory a compilation asset should not change
    // if the source file did not change
    // so we can avoid watching compilation asset
    if (urlIsCompilationAsset(`${projectDirectoryUrl}${relativeUrl}`)) {
      return
    }

    projectFileRequested.notify(relativeUrl, request)
  }
  const watchDescription = {
    ...livereloadWatchConfig,
    [jsenvDirectoryRelativeUrl]: false,
  }
  const unregisterDirectoryLifecyle = registerDirectoryLifecycle(projectDirectoryUrl, {
    watchDescription,
    updated: ({ relativeUrl }) => {
      projectFileModified.notify(relativeUrl)
    },
    removed: ({ relativeUrl }) => {
      projectFileRemoved.notify(relativeUrl)
    },
    added: ({ relativeUrl }) => {
      projectFileAdded.notify(relativeUrl)
    },
    keepProcessAlive: false,
    recursive: true,
  })
  cancellationToken.register(unregisterDirectoryLifecyle)

  const getDependencySet = (mainRelativeUrl) => {
    if (trackerMap.has(mainRelativeUrl)) {
      return trackerMap.get(mainRelativeUrl)
    }
    const dependencySet = new Set()
    dependencySet.add(mainRelativeUrl)
    trackerMap.set(mainRelativeUrl, dependencySet)
    return dependencySet
  }

  // each time a file is requested for the first time its dependencySet is computed
  projectFileRequested.register((mainRelativeUrl) => {
    // for now node use case of livereloading + node.js
    // and for browsers only html file can be main files
    // this avoid collecting dependencies of non html files that will never be used
    if (!mainRelativeUrl.endsWith(".html")) {
      return
    }

    // when a file is requested, always rebuild its dependency in case it has changed
    // since the last time it was requested
    const dependencySet = new Set()
    dependencySet.add(mainRelativeUrl)
    trackerMap.set(mainRelativeUrl, dependencySet)

    const unregisterDependencyRequested = projectFileRequested.register((relativeUrl, request) => {
      if (dependencySet.has(relativeUrl)) {
        return
      }

      const dependencyReport = reportDependency(relativeUrl, mainRelativeUrl, request)
      if (dependencyReport.dependency === false) {
        livereloadLogger.debug(
          `${relativeUrl} not a dependency of ${mainRelativeUrl} because ${dependencyReport.reason}`,
        )
        return
      }

      livereloadLogger.debug(
        `${relativeUrl} is a dependency of ${mainRelativeUrl} because ${dependencyReport.reason}`,
      )
      dependencySet.add(relativeUrl)
    })
    const unregisterMainRemoved = projectFileRemoved.register((relativeUrl) => {
      if (relativeUrl === mainRelativeUrl) {
        unregisterDependencyRequested()
        unregisterMainRemoved()
        trackerMap.delete(mainRelativeUrl)
      }
    })
  })

  const trackMainAndDependencies = (mainRelativeUrl, { modified, removed, added }) => {
    livereloadLogger.debug(`track ${mainRelativeUrl} and its dependencies`)

    const unregisterModified = projectFileModified.register((relativeUrl) => {
      const dependencySet = getDependencySet(mainRelativeUrl)
      if (dependencySet.has(relativeUrl)) {
        modified(relativeUrl)
      }
    })
    const unregisterRemoved = projectFileRemoved.register((relativeUrl) => {
      const dependencySet = getDependencySet(mainRelativeUrl)
      if (dependencySet.has(relativeUrl)) {
        removed(relativeUrl)
      }
    })
    const unregisterAdded = projectFileAdded.register((relativeUrl) => {
      const dependencySet = getDependencySet(mainRelativeUrl)
      if (dependencySet.has(relativeUrl)) {
        added(relativeUrl)
      }
    })

    return () => {
      livereloadLogger.debug(`stop tracking ${mainRelativeUrl} and its dependencies.`)
      unregisterModified()
      unregisterRemoved()
      unregisterAdded()
    }
  }

  const reportDependency = (relativeUrl, mainRelativeUrl, request) => {
    if (relativeUrl === mainRelativeUrl) {
      return {
        dependency: true,
        reason: "it's main",
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
      const refererRelativeUrl = urlToOriginalRelativeUrl(
        referer,
        resolveUrl(outDirectoryRelativeUrl, request.origin),
      )
      if (refererRelativeUrl) {
        // search if referer (file requesting this one) is tracked as being a dependency of main file
        // in that case because the importer is a dependency the importee is also a dependency
        // eslint-disable-next-line no-unused-vars
        for (const tracker of trackerMap) {
          if (tracker[0] === mainRelativeUrl && tracker[1].has(refererRelativeUrl)) {
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

  return { projectFileRequestedCallback, trackMainAndDependencies }
}

const createSSEForLivereloadService = ({
  cancellationToken,
  outDirectoryRelativeUrl,
  trackMainAndDependencies,
}) => {
  const cache = []
  const sseRoomLimit = 100
  const getOrCreateSSERoom = (mainFileRelativeUrl) => {
    const cacheEntry = cache.find(
      (cacheEntryCandidate) => cacheEntryCandidate.mainFileRelativeUrl === mainFileRelativeUrl,
    )
    if (cacheEntry) {
      return cacheEntry.sseRoom
    }

    const sseRoom = createSSERoom({
      retryDuration: 2000,
      historyLength: 100,
      welcomeEvent: true,
    })

    // each time something is modified or removed we send event to the room
    const stopTracking = trackMainAndDependencies(mainFileRelativeUrl, {
      modified: (relativeUrl) => {
        sseRoom.sendEvent({ type: "file-modified", data: relativeUrl })
      },
      removed: (relativeUrl) => {
        sseRoom.sendEvent({ type: "file-removed", data: relativeUrl })
      },
      added: (relativeUrl) => {
        sseRoom.sendEvent({ type: "file-added", data: relativeUrl })
      },
    })

    sseRoom.start()
    const cancelRegistration = cancellationToken.register(() => {
      cancelRegistration.unregister()

      sseRoom.stop()
      stopTracking()
    })
    cache.push({
      mainFileRelativeUrl,
      sseRoom,
      cleanup: () => {
        cancelRegistration.unregister()
        sseRoom.stop()
        stopTracking()
      },
    })
    if (cache.length >= sseRoomLimit) {
      const firstCacheEntry = cache.shift()
      firstCacheEntry.cleanup()
    }
    return sseRoom
  }

  return (request) => {
    const { accept } = request.headers
    if (!accept || !accept.includes("text/event-stream")) {
      return null
    }

    const fileRelativeUrl = urlToOriginalRelativeUrl(
      resolveUrl(request.ressource, request.origin),
      resolveUrl(outDirectoryRelativeUrl, request.origin),
    )

    const room = getOrCreateSSERoom(fileRelativeUrl)
    return room.connect(
      request.headers["last-event-id"] ||
        new URL(request.ressource, request.origin).searchParams.get("last-event-id"),
    )
  }
}

const urlToOriginalRelativeUrl = (url, outDirectoryRemoteUrl) => {
  if (urlIsInsideOf(url, outDirectoryRemoteUrl)) {
    const afterCompileDirectory = urlToRelativeUrl(url, outDirectoryRemoteUrl)
    const fileRelativeUrl = afterCompileDirectory.slice(afterCompileDirectory.indexOf("/") + 1)
    return fileRelativeUrl
  }
  return new URL(url).pathname.slice(1)
}

const createCompilationAssetFileService = ({ projectDirectoryUrl }) => {
  return (request) => {
    const { origin, ressource } = request
    const requestUrl = `${origin}${ressource}`
    if (urlIsCompilationAsset(requestUrl)) {
      return serveFile(request, {
        rootDirectoryUrl: projectDirectoryUrl,
        etagEnabled: true,
      })
    }
    return null
  }
}

const createBrowserScriptService = ({ projectDirectoryUrl, outDirectoryRelativeUrl }) => {
  const sourcemapMainFileRelativeUrl = urlToRelativeUrl(sourcemapMainFileUrl, projectDirectoryUrl)
  const sourcemapMappingFileRelativeUrl = urlToRelativeUrl(
    sourcemapMappingFileUrl,
    projectDirectoryUrl,
  )

  return (request) => {
    if (
      request.method === "GET" &&
      request.ressource === "/.jsenv/compile-meta.json" &&
      "x-jsenv" in request.headers
    ) {
      const body = JSON.stringify({
        outDirectoryRelativeUrl,
        errorStackRemapping: true,
        sourcemapMainFileRelativeUrl,
        sourcemapMappingFileRelativeUrl,
      })

      return {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
        body,
      }
    }

    return null
  }
}

const createProjectFileService = ({
  projectDirectoryUrl,
  projectFileRequestedCallback,
  projectFileEtagEnabled,
}) => {
  return (request) => {
    const { ressource } = request
    const relativeUrl = ressource.slice(1)
    projectFileRequestedCallback(relativeUrl, request)

    const responsePromise = serveFile(request, {
      rootDirectoryUrl: projectDirectoryUrl,
      etagEnabled: projectFileEtagEnabled,
    })

    return responsePromise
  }
}

const installOutFiles = async ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  outDirectoryRelativeUrl,
  importDefaultExtension,
  importMapFileRelativeUrl,
  compileServerGroupMap,
  env,
  onOutFileWritten = () => {},
}) => {
  const outDirectoryUrl = resolveUrl(outDirectoryRelativeUrl, projectDirectoryUrl)

  env = {
    ...env,
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    importDefaultExtension,
    importMapFileRelativeUrl,
  }

  const groupMapToString = () => JSON.stringify(compileServerGroupMap, null, "  ")
  const envToString = () => JSON.stringify(env, null, "  ")
  const groupMapOutFileUrl = resolveUrl("./groupMap.json", outDirectoryUrl)
  const envOutFileUrl = resolveUrl("./env.json", outDirectoryUrl)

  await Promise.all([
    writeFile(groupMapOutFileUrl, groupMapToString()),
    writeFile(envOutFileUrl, envToString()),
  ])

  onOutFileWritten(groupMapOutFileUrl)
  onOutFileWritten(envOutFileUrl)

  return async () => {
    removeFileSystemNode(groupMapOutFileUrl, { allowUseless: true })
    removeFileSystemNode(envOutFileUrl)
  }
}

const listenJsenvPackageVersionChange = ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  onJsenvPackageVersionChange = () => {},
}) => {
  const jsenvCoreDirectoryUrl = resolveUrl(jsenvDirectoryRelativeUrl, projectDirectoryUrl)
  const packageFileUrl = resolveUrl("./package.json", jsenvCoreDirectoryUrl)
  const packageFilePath = urlToFileSystemPath(packageFileUrl)
  let packageVersion

  try {
    packageVersion = readPackage(packageFilePath).version
  } catch (e) {
    if (e.code === "ENOENT") return () => {}
  }

  const checkPackageVersion = () => {
    let packageObject
    try {
      packageObject = readPackage(packageFilePath)
    } catch (e) {
      // package json deleted ? not a problem
      // let's wait for it to show back
      if (e.code === "ENOENT") return
      // package.json malformed ? not a problem
      // let's wait for use to fix it or filesystem to finish writing the file
      if (e.name === "SyntaxError") return
      throw e
    }

    if (packageVersion !== packageObject.version) {
      onJsenvPackageVersionChange()
    }
  }

  return registerFileLifecycle(packageFilePath, {
    added: checkPackageVersion,
    updated: checkPackageVersion,
    keepProcessAlive: false,
  })
}

const readPackage = (packagePath) => {
  const buffer = readFileSync(packagePath)
  const string = String(buffer)
  const packageObject = JSON.parse(string)
  return packageObject
}

export const STOP_REASON_PACKAGE_VERSION_CHANGED = {
  toString: () => `package version changed`,
}

const __filenameReplacement = `import.meta.url.slice('file:///'.length)`

const __dirnameReplacement = `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`
