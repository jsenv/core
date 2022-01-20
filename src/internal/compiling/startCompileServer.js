import {
  jsenvAccessControlAllowedHeaders,
  startServer,
  fetchFileSystem,
  createSSERoom,
  composeServices,
  pluginServerTiming,
  pluginRequestWaitingCheck,
  pluginCORS,
  readRequestBody,
} from "@jsenv/server"
import {
  resolveUrl,
  urlToRelativeUrl,
  resolveDirectoryUrl,
  registerDirectoryLifecycle,
  urlIsInsideOf,
  urlToExtension,
  ensureEmptyDirectory,
} from "@jsenv/filesystem"
import { createLogger, createDetailedMessage } from "@jsenv/logger"
import {
  createCallbackList,
  createCallbackListNotifiedOnce,
} from "@jsenv/abort"

import { isBrowserPartOfSupportedRuntimes } from "@jsenv/core/src/internal/runtime_support/runtime_support.js"

import { createJsenvRemoteDirectory } from "../jsenv_remote_directory.js"
import { babelPluginReplaceExpressions } from "../babel_plugin_replace_expressions.js"
import { jsenvDistDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"
import { setupOutDirectory } from "./out_directory/out_directory.js"
import { urlIsCompilationAsset } from "./out_directory/compile_asset.js"
import { loadBabelPluginMapFromFile } from "./load_babel_plugin_map_from_file.js"
import { extractSyntaxBabelPluginMap } from "./babel_plugins.js"
import { babelPluginGlobalThisAsJsenvImport } from "./babel_plugin_global_this_as_jsenv_import.js"
import { babelPluginNewStylesheetAsJsenvImport } from "./babel_plugin_new_stylesheet_as_jsenv_import.js"
import { babelPluginImportAssertions } from "./babel_plugin_import_assertions.js"
import { createCompiledFileService } from "./createCompiledFileService.js"
import { createTransformHtmlSourceFileService } from "./html_source_file_service.js"

let compileServerId = 0

export const startCompileServer = async ({
  signal = new AbortController().signal,
  handleSIGINT,
  logLevel,
  protocol = "http",
  http2 = protocol === "https",
  privateKey,
  certificate,
  ip = "0.0.0.0",
  port = 0,
  keepProcessAlive = false,
  onStop = () => {},

  projectDirectoryUrl,

  importDefaultExtension,

  jsenvDirectoryRelativeUrl = ".jsenv",
  outDirectoryClean = false,
  outDirectoryName = "out",

  sourcemapMethod = "comment", // "inline" is also possible
  sourcemapExcludeSources = false, // this should increase perf (no need to download source for browser)
  compileServerCanReadFromFilesystem = true,
  compileServerCanWriteOnFilesystem = true,
  compileCacheStrategy = "mtime",
  projectFileCacheStrategy = "mtime",

  // js compile options
  moduleOutFormat,
  importMetaFormat,
  topLevelAwait,
  processEnvNodeEnv = process.env.NODE_ENV,
  replaceProcessEnvNodeEnv = true,
  replaceGlobalObject = false,
  replaceGlobalFilename = false,
  replaceGlobalDirname = false,
  replaceMap = {},
  babelPluginMap,
  babelConfigFileUrl,
  customCompilers = {},
  preservedUrls,
  workers = [],
  serviceWorkers = [],
  importMapInWebWorkers = false,
  prependSystemJs,
  runtimeSupport,

  // remaining options
  livereloadWatchConfig = {
    "./**": true,
    "./**/.*/": false, // any folder starting with a dot is ignored (includes .git for instance)
    "./dist/": false,
    "./**/node_modules/": false,
  },
  livereloadLogLevel = "info",
  customServices = {},
  plugins,
  livereloadSSE = false,
  transformHtmlSourceFiles = true,
  jsenvScriptInjection = true,
  jsenvEventSourceClientInjection = false,
  jsenvToolbarInjection = false,
  inlineImportMapIntoHTML = true,
}) => {
  assertArguments({
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    outDirectoryName,
  })
  const logger = createLogger({ logLevel })
  const jsenvDirectoryUrl = resolveDirectoryUrl(
    jsenvDirectoryRelativeUrl,
    projectDirectoryUrl,
  )
  // normalizing "jsenvDirectoryRelativeUrl"
  jsenvDirectoryRelativeUrl = urlToRelativeUrl(
    jsenvDirectoryUrl,
    projectDirectoryUrl,
  )
  preservedUrls = {
    // Authorize jsenv to modify any file url
    // because the goal is to build the files into chunks
    "file://": false,
    // Preserves http and https urls
    // because if code specifiy a CDN url it's usually because code wants
    // to keep the url intact and keep HTTP request to CDN (both in dev and prod)
    "http://": true,
    "https://": true,
    /*
     * It's possible to selectively overrides the behaviour above:
     * 1. The CDN file needs to be transformed to be executable in dev, build or both
     * preservedUrls: {"https://cdn.skypack.dev/preact@10.6.4": false}
     * 2. No strong need to preserve the CDN dependency
     * 3. Prevent concatenation of a file during build
     * preservedUrls: {"./file.js": false}
     */
    ...preservedUrls,
  }
  const jsenvRemoteDirectory = createJsenvRemoteDirectory({
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    preservedUrls,
  })
  const workerUrls = workers.map((worker) =>
    resolveUrl(worker, projectDirectoryUrl),
  )
  const serviceWorkerUrls = serviceWorkers.map((serviceWorker) =>
    resolveUrl(serviceWorker, projectDirectoryUrl),
  )
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
  const featureNames = [
    ...(browser
      ? [
          "module",
          "importmap",
          "import_assertion_type_json",
          "import_assertion_type_css",
        ]
      : []),
    ...(browser && workerUrls.length > 0 ? ["worker_type_module"] : []),
    ...(browser && importMapInWebWorkers ? ["worker_importmap"] : []),
    ...Object.keys(babelPluginMapWithoutSyntax),
  ]
  babelPluginMap = {
    // When code should be compatible with browsers, ensure
    // process.env.NODE_ENV is replaced to be executable in a browser by forcing
    // "transform-replace-expressions" babel plugin.
    // It happens for module written in ESM but also using process.env.NODE_ENV
    // for example "react-redux"
    // This babel plugin won't force compilation because it's added after "featureNames"
    // however it will be used even if not part of "missingFeatureNames"
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
  const outDirectoryUrl = resolveUrl(outDirectoryName, jsenvDirectoryUrl)
  const outDirectoryRelativeUrl = urlToRelativeUrl(
    outDirectoryUrl,
    projectDirectoryUrl,
  )
  const outDirectoryMetaFileUrl = resolveUrl(
    "__out_meta__.json",
    jsenvDirectoryUrl,
  )
  if (outDirectoryClean) {
    await ensureEmptyDirectory(outDirectoryUrl)
  }
  const {
    compileDirectories,
    outDirectoryMeta,
    getOrCreateCompileDirectoryId,
  } = await setupOutDirectory({
    logger,
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    outDirectoryUrl,
    outDirectoryRelativeUrl,
    outDirectoryMetaFileUrl,

    importDefaultExtension,
    preservedUrls,
    workers,
    serviceWorkers,
    featureNames,
    babelPluginMap,
    replaceProcessEnvNodeEnv,
    processEnvNodeEnv,
    inlineImportMapIntoHTML,
    customCompilers,
    jsenvToolbarInjection,
    sourcemapMethod,
    sourcemapExcludeSources,

    compileServerCanWriteOnFilesystem,
  })

  const serverStopCallbackList = createCallbackListNotifiedOnce()
  let projectFileRequestedCallback = () => {}
  if (livereloadSSE) {
    const sseSetup = setupServerSentEventsForLivereload({
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      outDirectoryRelativeUrl,

      serverStopCallbackList,
      livereloadLogLevel,
      livereloadWatchConfig,
    })
    projectFileRequestedCallback = sseSetup.projectFileRequestedCallback
    const serveSSEForLivereload = createSSEForLivereloadService({
      outDirectoryRelativeUrl,
      serverStopCallbackList,
      trackMainAndDependencies: sseSetup.trackMainAndDependencies,
    })
    customServices = {
      ...customServices,
      "jsenv:sse": serveSSEForLivereload,
    }
  } else {
    const roomWhenLivereloadIsDisabled = createSSERoom()
    roomWhenLivereloadIsDisabled.open()
    customServices = {
      ...customServices,
      "jsenv:sse": (request) => {
        const { accept } = request.headers
        if (!accept || !accept.includes("text/event-stream")) {
          return null
        }
        return roomWhenLivereloadIsDisabled.join(request)
      },
    }
  }

  const jsenvServices = {
    "service:compile directories": async (request) => {
      const requestFileUrl = resolveUrl(
        request.ressource.slice(1),
        projectDirectoryUrl,
      )
      if (
        requestFileUrl !== outDirectoryMetaFileUrl &&
        // allow to request it directly from .jsenv
        request.ressource !== `/.jsenv/__out_meta__.json`
      ) {
        return null
      }
      if (request.method === "GET") {
        const body = JSON.stringify(outDirectoryMeta, null, "  ")
        return {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(body),
          },
          body,
        }
      }
      if (request.method === "POST") {
        const runtimeReport = await readRequestBody(request, {
          as: "json",
        })
        const compileDirectoryId = getOrCreateCompileDirectoryId({
          runtimeReport,
        })
        const responseBodyAsObject = {
          compileDirectoryId,
        }
        const responseBodyAsString = JSON.stringify(
          responseBodyAsObject,
          null,
          "  ",
        )
        return {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(responseBodyAsString),
          },
          body: responseBodyAsString,
        }
      }
      return null
    },
    "service:compilation asset": createCompilationAssetFileService({
      projectDirectoryUrl,
    }),
    "service:compiled file": createCompiledFileService({
      logger,

      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      compileDirectories,
      jsenvRemoteDirectory,

      importDefaultExtension,

      runtimeSupport,
      topLevelAwait,
      babelPluginMap,
      customCompilers,
      workerUrls,
      serviceWorkerUrls,
      importMapInWebWorkers,
      prependSystemJs,
      moduleOutFormat,
      importMetaFormat,
      jsenvEventSourceClientInjection,
      jsenvToolbarInjection,

      projectFileRequestedCallback,
      sourcemapMethod,
      sourcemapExcludeSources,
      compileCacheStrategy: compileServerCanReadFromFilesystem
        ? compileCacheStrategy
        : "none",
    }),
    ...(transformHtmlSourceFiles
      ? {
          "service:transform html source file":
            createTransformHtmlSourceFileService({
              logger,
              projectDirectoryUrl,
              projectFileRequestedCallback,
              inlineImportMapIntoHTML,
              jsenvScriptInjection,
              jsenvEventSourceClientInjection,
              jsenvToolbarInjection,
            }),
        }
      : {}),
    "service:source file": createSourceFileService({
      projectDirectoryUrl,
      jsenvRemoteDirectory,
      projectFileRequestedCallback,
      projectFileCacheStrategy,
    }),
  }

  const compileServer = await startServer({
    signal,
    stopOnExit: false,
    stopOnSIGINT: handleSIGINT,
    stopOnInternalError: false,
    sendServerInternalErrorDetails: true,
    keepProcessAlive,

    logLevel,

    protocol,
    http2,
    certificate,
    privateKey,
    ip,
    port,
    plugins: {
      ...plugins,
      ...pluginCORS({
        accessControlAllowRequestOrigin: true,
        accessControlAllowRequestMethod: true,
        accessControlAllowRequestHeaders: true,
        accessControlAllowedRequestHeaders: [
          ...jsenvAccessControlAllowedHeaders,
          "x-jsenv-execution-id",
        ],
        accessControlAllowCredentials: true,
      }),
      ...pluginServerTiming(),
      ...pluginRequestWaitingCheck({
        requestWaitingMs: 60 * 1000,
      }),
    },
    requestToResponse: composeServices({
      ...customServices,
      ...jsenvServices,
    }),
    onStop: (reason) => {
      onStop()
      serverStopCallbackList.notify(reason)
    },
  })

  return {
    id: compileServerId++,
    jsenvDirectoryRelativeUrl,
    compileDirectories,
    ...compileServer,
    featureNames,
    babelPluginMap,
    preservedUrls,
    projectFileRequestedCallback,
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
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  outDirectoryRelativeUrl,

  serverStopCallbackList,
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
    if (relativeUrl[0] === "/") {
      relativeUrl = relativeUrl.slice(1)
    }
    const url = `${projectDirectoryUrl}${relativeUrl}`

    if (
      // Do not watch sourcemap files
      urlToExtension(url) === ".map" ||
      // Do not watch compilation asset, watching source file is enough
      urlIsCompilationAsset(url)
    ) {
      return
    }

    projectFileRequested.notify({ relativeUrl, request })
  }
  const watchDescription = {
    ...livereloadWatchConfig,
    [jsenvDirectoryRelativeUrl]: false,
  }

  // wait 100ms to actually start watching
  // otherwise server starting is delayed by the filesystem scan done in
  // registerDirectoryLifecycle
  const timeout = setTimeout(() => {
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
    serverStopCallbackList.add(unregisterDirectoryLifecyle)
  }, 100)
  serverStopCallbackList.add(() => {
    clearTimeout(timeout)
  })

  const startTrackingRoot = (rootFile) => {
    stopTrackingRoot(rootFile)
    const set = new Set()
    set.add(rootFile)
    const depInfo = {
      set,
      cleanup: [],
    }
    trackerMap.set(rootFile, depInfo)
    return depInfo
  }
  const addStopTrackingCalback = (rootFile, callback) => {
    trackerMap.get(rootFile).cleanup.push(callback)
  }
  const stopTrackingRoot = (rootFile) => {
    const depInfo = trackerMap.get(rootFile)
    if (depInfo) {
      depInfo.cleanup.forEach((cb) => {
        cb()
      })
      trackerMap.delete(rootFile)
    }
  }
  const isDependencyOf = (file, rootFile) => {
    const depInfo = trackerMap.get(rootFile)
    return depInfo && depInfo.set.has(file)
  }
  const markAsDependencyOf = (file, rootFile) => {
    trackerMap.get(rootFile).set.add(file)
  }

  // each time a file is requested for the first time its dependencySet is computed
  projectFileRequested.add((requestInfo) => {
    const rootRelativeUrl = requestInfo.relativeUrl
    // for now no use case of livereloading on node.js
    // and for browsers only html file can be main files
    // this avoid collecting dependencies of non html files that will never be used
    if (!rootRelativeUrl.endsWith(".html")) {
      return
    }

    livereloadLogger.debug(`${rootRelativeUrl} requested -> start tracking it`)
    // when a file is requested, always rebuild its dependency in case it has changed
    // since the last time it was requested
    startTrackingRoot(rootRelativeUrl)

    const removeDependencyRequestedCallback = projectFileRequested.add(
      ({ relativeUrl, request }) => {
        if (isDependencyOf(relativeUrl, rootRelativeUrl)) {
          return
        }
        const dependencyReport = reportDependency(
          relativeUrl,
          rootRelativeUrl,
          request,
        )
        if (dependencyReport.dependency === false) {
          livereloadLogger.debug(
            `${relativeUrl} not a dependency of ${rootRelativeUrl} because ${dependencyReport.reason}`,
          )
          return
        }
        livereloadLogger.debug(
          `${relativeUrl} is a dependency of ${rootRelativeUrl} because ${dependencyReport.reason}`,
        )
        markAsDependencyOf(relativeUrl, rootRelativeUrl)
      },
    )
    addStopTrackingCalback(rootRelativeUrl, removeDependencyRequestedCallback)
    const removeRootRemovedCallback = projectFileRemoved.add((relativeUrl) => {
      if (relativeUrl === rootRelativeUrl) {
        stopTrackingRoot(rootRelativeUrl)
        livereloadLogger.debug(`${rootRelativeUrl} removed -> stop tracking it`)
      }
    })
    addStopTrackingCalback(rootRelativeUrl, removeRootRemovedCallback)
  })

  const trackMainAndDependencies = (
    mainRelativeUrl,
    { modified, removed, added },
  ) => {
    livereloadLogger.debug(`track ${mainRelativeUrl} and its dependencies`)

    const removeModifiedCallback = projectFileModified.add((relativeUrl) => {
      if (isDependencyOf(relativeUrl, mainRelativeUrl)) {
        modified(relativeUrl)
      }
    })
    const removeRemovedCallback = projectFileRemoved.add((relativeUrl) => {
      if (isDependencyOf(relativeUrl, mainRelativeUrl)) {
        removed(relativeUrl)
      }
    })
    const removeAddedCallback = projectFileAdded.add((relativeUrl) => {
      if (isDependencyOf(relativeUrl, mainRelativeUrl)) {
        added(relativeUrl)
      }
    })

    return () => {
      livereloadLogger.debug(
        `stop tracking ${mainRelativeUrl} and its dependencies.`,
      )
      removeModifiedCallback()
      removeRemovedCallback()
      removeAddedCallback()
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
            tracker[1].set.has(refererRelativeUrl)
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
  outDirectoryRelativeUrl,
  serverStopCallbackList,
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

    const removeSSECleanupCallback = serverStopCallbackList.add(() => {
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
      return fetchFileSystem(
        new URL(request.ressource.slice(1), projectDirectoryUrl),
        {
          headers: request.headers,
          etagEnabled: true,
        },
      )
    }
    return null
  }
}

const createSourceFileService = ({
  projectDirectoryUrl,
  projectFileRequestedCallback,
  projectFileCacheStrategy,
  jsenvRemoteDirectory,
}) => {
  return async (request) => {
    const relativeUrl = request.pathname.slice(1)
    projectFileRequestedCallback(relativeUrl, request)
    const fileUrl = new URL(request.ressource.slice(1), projectDirectoryUrl)
      .href
    const fileIsInsideJsenvDistDirectory = urlIsInsideOf(
      fileUrl,
      jsenvDistDirectoryUrl,
    )
    const fromFileSystem = () =>
      fetchFileSystem(fileUrl, {
        headers: request.headers,
        etagEnabled: projectFileCacheStrategy === "etag",
        mtimeEnabled: projectFileCacheStrategy === "mtime",
        ...(fileIsInsideJsenvDistDirectory
          ? {
              cacheControl: `private,max-age=${60 * 60 * 24 * 30},immutable`,
            }
          : {}),
      })
    const filesystemResponse = await fromFileSystem()
    if (
      filesystemResponse.status === 404 &&
      jsenvRemoteDirectory.isFileUrlForRemoteUrl(fileUrl)
    ) {
      try {
        await jsenvRemoteDirectory.loadFileUrlFromRemote(fileUrl, request)
        // re-fetch filesystem instead to ensure response headers are correct
        return fromFileSystem()
      } catch (e) {
        if (e && e.asResponse) {
          return e.asResponse()
        }
        throw e
      }
    }
    return filesystemResponse
  }
}

const __filenameReplacement = `import.meta.url.slice('file:///'.length)`

const __dirnameReplacement = `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`
