import { readFileSync } from "node:fs"
import {
  jsenvAccessControlAllowedHeaders,
  startServer,
  serveFile,
  createSSERoom,
  composeServicesWithTiming,
  urlToContentType,
} from "@jsenv/server"
import { createLogger, createDetailedMessage } from "@jsenv/logger"
import {
  resolveUrl,
  urlToFileSystemPath,
  urlToRelativeUrl,
  resolveDirectoryUrl,
  readFile,
  writeFile,
  ensureEmptyDirectory,
  registerFileLifecycle,
  registerDirectoryLifecycle,
  urlIsInsideOf,
  urlToBasename,
} from "@jsenv/filesystem"

import { Abort, Cleanup } from "@jsenv/core/src/abort/main.js"
import { isBrowserPartOfSupportedRuntimes } from "@jsenv/core/src/internal/generateGroupMap/runtime_support.js"
import { loadBabelPluginMapFromFile } from "./load_babel_plugin_map_from_file.js"
import { extractSyntaxBabelPluginMap } from "./babel_plugins.js"
import { generateGroupMap } from "../generateGroupMap/generateGroupMap.js"
import { createCallbackList } from "../createCallbackList.js"
import {
  jsenvCompileProxyFileInfo,
  sourcemapMainFileInfo,
  sourcemapMappingFileInfo,
} from "../jsenvInternalFiles.js"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"
import { babelPluginReplaceExpressions } from "../babel_plugin_replace_expressions.js"
import { babelPluginGlobalThisAsJsenvImport } from "./babel_plugin_global_this_as_jsenv_import.js"
import { babelPluginNewStylesheetAsJsenvImport } from "./babel_plugin_new_stylesheet_as_jsenv_import.js"
import { babelPluginImportAssertions } from "./babel_plugin_import_assertions.js"
import { createCompiledFileService } from "./createCompiledFileService.js"
import { urlIsCompilationAsset } from "./compile-directory/compile-asset.js"
import { createTransformHtmlSourceFileService } from "./html_source_file_service.js"

export const startCompileServer = async ({
  abortSignal = Abort.dormantSignal(),
  compileServerLogLevel,

  projectDirectoryUrl,

  importDefaultExtension,

  jsenvDirectoryRelativeUrl = ".jsenv",
  jsenvDirectoryClean = false,
  outDirectoryName = "out",

  sourcemapMethod = "comment", // "inline" is also possible
  sourcemapExcludeSources = false, // this should increase perf (no need to download source for browser)
  compileServerCanReadFromFilesystem = true,
  compileServerCanWriteOnFilesystem = true,
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
  babelPluginMap,
  babelConfigFileUrl,
  customCompilers = {},

  // options related to the server itself
  compileServerProtocol = "http",
  compileServerHttp2 = compileServerProtocol === "https",
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp = "0.0.0.0",
  compileServerPort = 0,
  keepProcessAlive = false,
  stopOnPackageVersionChange = false,

  // remaining options
  runtimeSupport,

  livereloadWatchConfig = {
    "./**": true,
    "./**/.*/": false, // any folder starting with a dot is ignored (includes .git for instance)
    "./dist/": false,
    "./**/node_modules/": false,
  },
  livereloadLogLevel = "info",
  customServices = {},
  livereloadSSE = false,
  transformHtmlSourceFiles = true,
  jsenvToolbarInjection = false,
  jsenvScriptInjection = true,
  inlineImportMapIntoHTML = true,
}) => {
  assertArguments({
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    outDirectoryName,
  })

  const jsenvDirectoryUrl = resolveDirectoryUrl(
    jsenvDirectoryRelativeUrl,
    projectDirectoryUrl,
  )
  const outDirectoryUrl = resolveDirectoryUrl(
    outDirectoryName,
    jsenvDirectoryUrl,
  )
  const outDirectoryRelativeUrl = urlToRelativeUrl(
    outDirectoryUrl,
    projectDirectoryUrl,
  )
  // normalization
  jsenvDirectoryRelativeUrl = urlToRelativeUrl(
    jsenvDirectoryUrl,
    projectDirectoryUrl,
  )

  const logger = createLogger({ logLevel: compileServerLogLevel })

  const browser = isBrowserPartOfSupportedRuntimes(runtimeSupport)
  const babelPluginMapFromFile = await loadBabelPluginMapFromFile({
    projectDirectoryUrl,
    babelConfigFileUrl,
  })
  babelPluginMap = {
    "global-this-as-jsenv-import": babelPluginGlobalThisAsJsenvImport,
    "new-stylesheet-as-jsenv-import": babelPluginNewStylesheetAsJsenvImport,
    "transform-import-assertions": babelPluginImportAssertions,
    ...babelPluginMapFromFile,
    ...babelPluginMap,
  }
  Object.keys(babelPluginMap).forEach((key) => {
    if (
      key === "transform-modules-commonjs" ||
      key === "transform-modules-amd" ||
      key === "transform-modules-systemjs"
    ) {
      const declaredInFile = Boolean(babelPluginMapFromFile[key])
      logger.warn(
        createDetailedMessage(
          `WARNING: "${key}" babel plugin should not be enabled, it will be ignored`,
          {
            suggestion: declaredInFile
              ? `To get rid of this warning, remove "${key}" from babel config file. Either with "modules": false in @babel/preset-env or removing "@babel/${key}" from plugins`
              : `To get rid of this warning, remove "${key}" from babelPluginMap parameter`,
          },
        ),
      )
      delete babelPluginMap[key]
    }
  })

  const { babelSyntaxPluginMap, babelPluginMapWithoutSyntax } =
    extractSyntaxBabelPluginMap(babelPluginMap)
  const compileServerGroupMap = generateGroupMap({
    babelPluginMap: babelPluginMapWithoutSyntax,
    runtimeSupport,
  })

  babelPluginMap = {
    // When code should be compatible with browsers, ensure
    // process.env.NODE_ENV is replaced to be executable in a browser by forcing
    // "transform-replace-expressions" babel plugin.
    // It happens for module written in ESM but also using process.env.NODE_ENV
    // for example "react-redux"
    // This babel plugin won't force compilation because it's added after "generateGroupMap"
    // however it will be used even if not part of "pluginRequiredNameArray"
    // as visible in "babelPluginMapFromCompileId"
    // This is a quick workaround to get things working because:
    // - If none of your code needs to be compiled but one of your dependency
    //   uses process.env.NODE_ENV, the code will throw "process" is undefined
    //   This is fine but you won't have a dedicated way to force compilation to ensure
    //   "process.env.NODE_ENV" is replaced.
    // Ideally this should be a custom compiler dedicated for this use case. It's not the case
    // for now because it was faster to do it this way and the use case is a bit blurry:
    // What should this custom compiler do? Just replace some node globals? How would it be named and documented?
    ...(browser
      ? {
          "transform-replace-expressions": [
            babelPluginReplaceExpressions,
            {
              replaceMap: {
                ...(replaceProcessEnvNodeEnv
                  ? { "process.env.NODE_ENV": `("${processEnvNodeEnv}")` }
                  : {}),
                ...(replaceGlobalObject ? { global: "globalThis" } : {}),
                ...(replaceGlobalFilename
                  ? { __filename: __filenameReplacement }
                  : {}),
                ...(replaceGlobalDirname
                  ? { __dirname: __dirnameReplacement }
                  : {}),
                ...replaceMap,
              },
              allowConflictingReplacements: true,
            },
          ],
        }
      : {}),
    ...babelSyntaxPluginMap,
    ...babelPluginMap,
  }

  const serverCleanup = Cleanup.create()

  let projectFileRequestedCallback = () => {}
  if (livereloadSSE) {
    const sseSetup = setupServerSentEventsForLivereload({
      serverCleanup,
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      outDirectoryRelativeUrl,
      livereloadLogLevel,
      livereloadWatchConfig,
    })

    projectFileRequestedCallback = sseSetup.projectFileRequestedCallback
    const serveSSEForLivereload = createSSEForLivereloadService({
      serverCleanup,
      outDirectoryRelativeUrl,
      trackMainAndDependencies: sseSetup.trackMainAndDependencies,
    })
    customServices = {
      "service:sse": serveSSEForLivereload,
      ...customServices,
    }
  } else {
    const roomWhenLivereloadIsDisabled = createSSERoom()
    roomWhenLivereloadIsDisabled.open()
    customServices = {
      "service:sse": (request) => {
        const { accept } = request.headers
        if (!accept || !accept.includes("text/event-stream")) {
          return null
        }
        return roomWhenLivereloadIsDisabled.join(request)
      },
      ...customServices,
    }
  }

  const outJSONFiles = createOutJSONFiles({
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    importDefaultExtension,
    compileServerGroupMap,
    env,
    inlineImportMapIntoHTML,
    babelPluginMap,
    customCompilers,
    jsenvToolbarInjection,
    sourcemapMethod,
    sourcemapExcludeSources,
  })
  if (compileServerCanWriteOnFilesystem) {
    await setupOutDirectory({
      logger,
      outDirectoryMeta: outJSONFiles.meta.data,
      outDirectoryUrl,
      jsenvDirectoryUrl,
      jsenvDirectoryClean,
    })
  }

  const jsenvServices = {
    "service:compilation asset": createCompilationAssetFileService({
      projectDirectoryUrl,
    }),
    "service:browser script": createBrowserScriptService({
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
    }),
    "service:out files": await createOutFilesService({
      logger,
      projectDirectoryUrl,
      compileServerCanWriteOnFilesystem,
      outDirectoryUrl,
      outJSONFiles,
    }),
    "service: compile proxy": createCompileProxyService({
      projectDirectoryUrl,
    }),
    "service:compiled file": createCompiledFileService({
      abortSignal,
      logger,

      projectDirectoryUrl,
      outDirectoryRelativeUrl,

      importDefaultExtension,

      runtimeSupport,
      transformTopLevelAwait,
      groupMap: compileServerGroupMap,
      babelPluginMap,
      customCompilers,
      moduleOutFormat,
      importMetaFormat,
      jsenvToolbarInjection,

      projectFileRequestedCallback,
      useFilesystemAsCache: compileServerCanReadFromFilesystem,
      writeOnFilesystem: compileServerCanWriteOnFilesystem,
      sourcemapMethod,
      sourcemapExcludeSources,
      compileCacheStrategy,
    }),
    ...(transformHtmlSourceFiles
      ? {
          "service:transform html source file":
            createTransformHtmlSourceFileService({
              logger,
              projectDirectoryUrl,
              inlineImportMapIntoHTML,
              jsenvScriptInjection,
              jsenvToolbarInjection,
            }),
        }
      : {}),
    "service:source file": createSourceFileService({
      logger,
      projectDirectoryUrl,
      projectFileRequestedCallback,
      projectFileEtagEnabled,
      transformHtmlSourceFiles,
      inlineImportMapIntoHTML,
      jsenvScriptInjection,
      jsenvToolbarInjection,
    }),
  }

  const compileServer = await startServer({
    abortSignal,
    logLevel: compileServerLogLevel,

    protocol: compileServerProtocol,
    http2: compileServerHttp2,
    serverCertificate: compileServerCertificate,
    serverCertificatePrivateKey: compileServerPrivateKey,
    ip: compileServerIp,
    port: compileServerPort,
    sendServerTiming: true,
    // nagle: false,
    requestWaitingMs: 60 * 1000,
    sendServerInternalErrorDetails: true,
    requestToResponse: composeServicesWithTiming({
      ...customServices,
      ...jsenvServices,
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

  if (stopOnPackageVersionChange) {
    const stopListeningJsenvPackageVersionChange =
      listenJsenvPackageVersionChange({
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
    ...compileServer,
    compileServerGroupMap,
    babelPluginMap,
  }
}

export const computeOutDirectoryRelativeUrl = ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl = ".jsenv",
  outDirectoryName = "out",
}) => {
  const jsenvDirectoryUrl = resolveDirectoryUrl(
    jsenvDirectoryRelativeUrl,
    projectDirectoryUrl,
  )
  const outDirectoryUrl = resolveDirectoryUrl(
    outDirectoryName,
    jsenvDirectoryUrl,
  )
  const outDirectoryRelativeUrl = urlToRelativeUrl(
    outDirectoryUrl,
    projectDirectoryUrl,
  )

  return outDirectoryRelativeUrl
}

const assertArguments = ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  outDirectoryName,
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(
      `projectDirectoryUrl must be a string. got ${projectDirectoryUrl}`,
    )
  }

  if (typeof jsenvDirectoryRelativeUrl !== "string") {
    throw new TypeError(
      `jsenvDirectoryRelativeUrl must be a string. got ${jsenvDirectoryRelativeUrl}`,
    )
  }
  const jsenvDirectoryUrl = resolveDirectoryUrl(
    jsenvDirectoryRelativeUrl,
    projectDirectoryUrl,
  )

  if (!jsenvDirectoryUrl.startsWith(projectDirectoryUrl)) {
    throw new TypeError(
      createDetailedMessage(
        `jsenv directory must be inside project directory`,
        {
          ["jsenv directory url"]: jsenvDirectoryUrl,
          ["project directory url"]: projectDirectoryUrl,
        },
      ),
    )
  }

  if (typeof outDirectoryName !== "string") {
    throw new TypeError(
      `outDirectoryName must be a string. got ${outDirectoryName}`,
    )
  }
}

const setupOutDirectory = async ({
  logger,
  outDirectoryMeta,
  outDirectoryUrl,
  jsenvDirectoryClean,
  jsenvDirectoryUrl,
}) => {
  if (jsenvDirectoryClean) {
    logger.debug(
      `Cleaning jsenv directory because jsenvDirectoryClean parameter enabled`,
    )
    await ensureEmptyDirectory(jsenvDirectoryUrl)
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
    const outDirectoryChanges = getOutDirectoryChanges(
      previousOutDirectoryMeta,
      outDirectoryMeta,
    )

    if (outDirectoryChanges) {
      if (!jsenvDirectoryClean) {
        logger.debug(
          createDetailedMessage(
            `Cleaning jsenv ${urlToBasename(
              outDirectoryUrl.slice(0, -1),
            )} directory because configuration has changed.`,
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
}

const getOutDirectoryChanges = (previousOutDirectoryMeta, outDirectoryMeta) => {
  const changes = []

  Object.keys(outDirectoryMeta).forEach((key) => {
    const now = outDirectoryMeta[key]
    const previous = previousOutDirectoryMeta[key]
    if (!compareValueJson(now, previous)) {
      changes.push(key)
    }
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
  serverCleanup,
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
  const unregisterDirectoryLifecyle = registerDirectoryLifecycle(
    projectDirectoryUrl,
    {
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
    },
  )
  serverCleanup.addCallback(unregisterDirectoryLifecyle)

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
    // for now no use case of livereloading on node.js
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

    const unregisterDependencyRequested = projectFileRequested.register(
      (relativeUrl, request) => {
        if (dependencySet.has(relativeUrl)) {
          return
        }

        const dependencyReport = reportDependency(
          relativeUrl,
          mainRelativeUrl,
          request,
        )
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
      },
    )
    const unregisterMainRemoved = projectFileRemoved.register((relativeUrl) => {
      if (relativeUrl === mainRelativeUrl) {
        unregisterDependencyRequested()
        unregisterMainRemoved()
        trackerMap.delete(mainRelativeUrl)
      }
    })
  })

  const trackMainAndDependencies = (
    mainRelativeUrl,
    { modified, removed, added },
  ) => {
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
      livereloadLogger.debug(
        `stop tracking ${mainRelativeUrl} and its dependencies.`,
      )
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

    const { referer } = request.headers
    if (referer) {
      const { origin } = request
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
          if (
            tracker[0] === mainRelativeUrl &&
            tracker[1].has(refererRelativeUrl)
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

  return {
    projectFileRequestedCallback,
    trackMainAndDependencies,
  }
}

const createSSEForLivereloadService = ({
  serverCleanup,
  outDirectoryRelativeUrl,
  trackMainAndDependencies,
}) => {
  const cache = []
  const sseRoomLimit = 100
  const getOrCreateSSERoom = (mainFileRelativeUrl) => {
    const cacheEntry = cache.find(
      (cacheEntryCandidate) =>
        cacheEntryCandidate.mainFileRelativeUrl === mainFileRelativeUrl,
    )
    if (cacheEntry) {
      return cacheEntry.sseRoom
    }

    const sseRoom = createSSERoom({
      retryDuration: 2000,
      historyLength: 100,
      welcomeEventEnabled: true,
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

    const removeSSECleanupCallback = serverCleanup.addCallback(() => {
      removeSSECleanupCallback()
      sseRoom.close()
      stopTracking()
    })
    cache.push({
      mainFileRelativeUrl,
      sseRoom,
      cleanup: () => {
        removeSSECleanupCallback()
        sseRoom.close()
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
    return room.join(request)
  }
}

const urlToOriginalRelativeUrl = (url, outDirectoryRemoteUrl) => {
  if (urlIsInsideOf(url, outDirectoryRemoteUrl)) {
    const afterCompileDirectory = urlToRelativeUrl(url, outDirectoryRemoteUrl)
    const fileRelativeUrl = afterCompileDirectory.slice(
      afterCompileDirectory.indexOf("/") + 1,
    )
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

const createBrowserScriptService = ({
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
}) => {
  const sourcemapMainFileRelativeUrl = urlToRelativeUrl(
    sourcemapMainFileInfo.url,
    projectDirectoryUrl,
  )
  const sourcemapMappingFileRelativeUrl = urlToRelativeUrl(
    sourcemapMappingFileInfo.url,
    projectDirectoryUrl,
  )

  return (request) => {
    if (
      request.method === "GET" &&
      request.ressource === "/.jsenv/compile-meta.json"
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

const createSourceFileService = ({
  projectDirectoryUrl,
  projectFileRequestedCallback,
  projectFileEtagEnabled,
}) => {
  return async (request) => {
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

const createOutJSONFiles = ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  outDirectoryRelativeUrl,
  importDefaultExtension,
  compileServerGroupMap,
  babelPluginMap,
  replaceProcessEnvNodeEnv,
  processEnvNodeEnv,
  env,
  inlineImportMapIntoHTML,
  customCompilers,
  jsenvToolbarInjection,
  sourcemapMethod,
  sourcemapExcludeSources,
}) => {
  const outJSONFiles = {}
  const outDirectoryUrl = resolveUrl(
    outDirectoryRelativeUrl,
    projectDirectoryUrl,
  )

  const metaOutFileUrl = resolveUrl("./meta.json", outDirectoryUrl)
  const jsenvCorePackageFileUrl = resolveUrl(
    "./package.json",
    jsenvCoreDirectoryUrl,
  )
  const jsenvCorePackageFilePath = urlToFileSystemPath(jsenvCorePackageFileUrl)
  const jsenvCorePackageVersion = readPackage(jsenvCorePackageFilePath).version
  const customCompilerPatterns = Object.keys(customCompilers)
  const outDirectoryMeta = {
    jsenvCorePackageVersion,
    babelPluginMap: babelPluginMapAsData(babelPluginMap),
    compileServerGroupMap,
    replaceProcessEnvNodeEnv,
    processEnvNodeEnv,
    customCompilerPatterns,
    jsenvToolbarInjection,
    sourcemapMethod,
    sourcemapExcludeSources,
  }
  outJSONFiles.meta = {
    url: metaOutFileUrl,
    data: outDirectoryMeta,
  }

  const envOutFileUrl = resolveUrl("./env.json", outDirectoryUrl)
  env = {
    ...env,
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    importDefaultExtension,
    inlineImportMapIntoHTML,
    customCompilerPatterns,
  }
  outJSONFiles.env = {
    url: envOutFileUrl,
    data: env,
  }

  const groupMapOutFileUrl = resolveUrl("./groupMap.json", outDirectoryUrl)
  outJSONFiles.groupMap = {
    url: groupMapOutFileUrl,
    data: compileServerGroupMap,
  }

  return outJSONFiles
}

const babelPluginMapAsData = (babelPluginMap) => {
  const data = {}
  Object.keys(babelPluginMap).forEach((key) => {
    const value = babelPluginMap[key]
    if (Array.isArray(value)) {
      data[key] = value
      return
    }
    if (typeof value === "object") {
      data[key] = {
        options: value.options,
      }
      return
    }
    data[key] = value
  })
  return data
}

const createOutFilesService = async ({
  logger,
  projectDirectoryUrl,
  compileServerCanWriteOnFilesystem,
  outDirectoryUrl,
  outJSONFiles,
}) => {
  const isOutRootFile = (url) => {
    if (!urlIsInsideOf(url, outDirectoryUrl)) {
      return false
    }
    const afterOutDirectory = url.slice(outDirectoryUrl.length)
    if (afterOutDirectory.indexOf("/") > -1) {
      return false
    }
    return true
  }

  if (compileServerCanWriteOnFilesystem) {
    await Promise.all(
      Object.keys(outJSONFiles).map(async (name) => {
        const outJSONFile = outJSONFiles[name]
        await writeFile(
          outJSONFile.url,
          JSON.stringify(outJSONFile.data, null, "  "),
        )
        logger.debug(`-> ${outJSONFile.url}`)
      }),
    )

    return async (request) => {
      const requestUrl = resolveUrl(
        request.ressource.slice(1),
        projectDirectoryUrl,
      )
      if (!isOutRootFile(requestUrl)) {
        return null
      }
      return serveFile(request, {
        rootDirectoryUrl: projectDirectoryUrl,
        etagEnabled: true,
      })
    }
  }
  // serve from memory
  return (request) => {
    const requestUrl = resolveUrl(
      request.ressource.slice(1),
      projectDirectoryUrl,
    )
    if (!isOutRootFile(requestUrl)) {
      return null
    }

    const outJSONFileKey = Object.keys(outJSONFiles).find((name) => {
      return outJSONFiles[name].url === requestUrl
    })
    if (!outJSONFileKey) {
      return {
        status: 404,
      }
    }

    const outJSONFile = outJSONFiles[outJSONFileKey]
    const body = JSON.stringify(outJSONFile.data, null, "  ")
    return {
      status: 200,
      headers: {
        "content-type": urlToContentType(requestUrl),
        "content-length": Buffer.byteLength(body),
      },
      body,
    }
  }
}

const createCompileProxyService = ({ projectDirectoryUrl }) => {
  const jsenvCompileProxyRelativeUrlForProject = urlToRelativeUrl(
    jsenvCompileProxyFileInfo.jsenvBuildUrl,
    projectDirectoryUrl,
  )

  return (request) => {
    if (request.ressource === "/.jsenv/jsenv_compile_proxy.js") {
      const jsenvCompileProxyBuildServerUrl = `${request.origin}/${jsenvCompileProxyRelativeUrlForProject}`
      return {
        status: 307,
        headers: {
          location: jsenvCompileProxyBuildServerUrl,
        },
      }
    }

    return null
  }
}

const listenJsenvPackageVersionChange = ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  onJsenvPackageVersionChange = () => {},
}) => {
  const jsenvCoreDirectoryUrl = resolveUrl(
    jsenvDirectoryRelativeUrl,
    projectDirectoryUrl,
  )
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
