/* eslint-disable import/max-dependencies */
import { readFileSync } from "fs"
import {
  createCancellationToken,
  createCancellationSource,
  composeCancellationToken,
} from "@jsenv/cancellation"
import { composeTwoImportMaps } from "@jsenv/import-map"
import { generateImportMapForPackage } from "@jsenv/node-module-import-map"
import {
  jsenvAccessControlAllowedHeaders,
  startServer,
  serveFile,
  createSSERoom,
  firstServiceWithTiming,
} from "@jsenv/server"
import { createLogger } from "@jsenv/logger"
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
  fileSystemPathToUrl,
  registerDirectoryLifecycle,
  urlIsInsideOf,
} from "@jsenv/util"
import { COMPILE_ID_GLOBAL_BUNDLE } from "../CONSTANTS.js"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"
import { assertImportMapFileRelativeUrl, assertImportMapFileInsideProject } from "../argUtils.js"
import { babelPluginReplaceExpressions } from "../babel-plugin-replace-expressions.js"
import { generateGroupMap } from "../generateGroupMap/generateGroupMap.js"
import { jsenvBabelPluginCompatMap } from "../../jsenvBabelPluginCompatMap.js"
import { jsenvBrowserScoreMap } from "../../jsenvBrowserScoreMap.js"
import { jsenvNodeVersionScoreMap } from "../../jsenvNodeVersionScoreMap.js"
import { jsenvBabelPluginMap } from "../../jsenvBabelPluginMap.js"
import { require } from "../require.js"
import { createCallbackList } from "../createCallbackList.js"
import { readProjectImportMap } from "./readProjectImportMap.js"
import { createCompiledFileService } from "./createCompiledFileService.js"
import { urlIsAsset } from "./urlIsAsset.js"

export const startCompileServer = async ({
  cancellationToken = createCancellationToken(),
  compileServerLogLevel,

  projectDirectoryUrl,
  importMapFileRelativeUrl = "importMap.json",
  importDefaultExtension,
  jsenvDirectoryRelativeUrl = ".jsenv",
  jsenvDirectoryClean = false,
  outDirectoryName = "out",

  writeOnFilesystem = true,
  useFilesystemAsCache = true,
  compileCacheStrategy = "etag",

  // js compile options
  transformTopLevelAwait = true,
  transformModuleIntoSystemFormat = true,
  env = {},
  processEnvNodeEnv = process.env.NODE_ENV,
  replaceProcessEnvNodeEnv = true,
  replaceGlobalObject = false,
  replaceGlobalFilename = false,
  replaceGlobalDirname = false,
  replaceMap = {},
  babelPluginMap = jsenvBabelPluginMap,
  convertMap = {},

  // options related to the server itself
  compileServerProtocol = "https",
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp = "0.0.0.0",
  compileServerPort = 0,
  keepProcessAlive = false,
  stopOnPackageVersionChange = false,

  // remaining options are complex or private
  compileGroupCount = 1,
  babelCompatMap = jsenvBabelPluginCompatMap,
  browserScoreMap = jsenvBrowserScoreMap,
  nodeVersionScoreMap = jsenvNodeVersionScoreMap,
  runtimeAlwaysInsideRuntimeScoreMap = false,

  livereloadWatchConfig = {
    "./**/*": true,
    "./**/.git/": false,
    "./**/node_modules/": false,
  },
  livereloadLogLevel = "info",
  customServices = {},
  headScripts = [],
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
  const groupMap = generateGroupMap({
    babelPluginMap,
    babelCompatMap,
    runtimeScoreMap: { ...browserScoreMap, node: nodeVersionScoreMap },
    groupCount: compileGroupCount,
    runtimeAlwaysInsideRuntimeScoreMap,
  })
  const compileServerImportMap = await generateImportMapForCompileServer({
    logger,
    projectDirectoryUrl,
    outDirectoryRelativeUrl,
    importMapFileRelativeUrl,
  })

  await setupOutDirectory(outDirectoryUrl, {
    logger,
    jsenvDirectoryUrl,
    jsenvDirectoryClean,
    useFilesystemAsCache,
    babelPluginMap,
    convertMap,
    groupMap,
  })

  const serverStopCancellationSource = createCancellationSource()

  const {
    projectFileRequestedCallback,
    trackMainAndDependencies,
  } = await setupServerSentEventsForLivereload({
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

  const browserJsFileUrl = resolveUrl(
    "./src/internal/browser-launcher/jsenv-browser-system.js",
    jsenvCoreDirectoryUrl,
  )
  const browserjsFileRelativeUrl = urlToRelativeUrl(browserJsFileUrl, projectDirectoryUrl)
  const browserBundledJsFileRelativeUrl = `${outDirectoryRelativeUrl}${COMPILE_ID_GLOBAL_BUNDLE}/${browserjsFileRelativeUrl}`

  const serveSSEForLivereload = createSSEForLivereloadService({
    cancellationToken,
    outDirectoryRelativeUrl,
    trackMainAndDependencies,
  })
  const serveAssetFile = createAssetFileService({ projectDirectoryUrl })
  const serveBrowserScript = createBrowserScriptService({
    projectDirectoryUrl,
    outDirectoryRelativeUrl,
    browserBundledJsFileRelativeUrl,
  })
  const serveCompiledFile = createCompiledFileService({
    cancellationToken,
    logger,

    projectDirectoryUrl,
    outDirectoryRelativeUrl,
    browserBundledJsFileRelativeUrl,
    compileServerImportMap,
    importMapFileRelativeUrl,
    importDefaultExtension,

    transformTopLevelAwait,
    transformModuleIntoSystemFormat,
    babelPluginMap,
    groupMap,
    convertMap,
    headScripts,

    projectFileRequestedCallback,
    useFilesystemAsCache,
    writeOnFilesystem,
    compileCacheStrategy,
  })
  const serveProjectFile = createProjectFileService({
    projectDirectoryUrl,
    projectFileRequestedCallback,
  })

  const compileServer = await startServer({
    cancellationToken,
    logLevel: compileServerLogLevel,
    serverName: "compile server",

    protocol: compileServerProtocol,
    http2: compileServerProtocol === "https",
    redirectHttpToHttps: compileServerProtocol === "https",
    privateKey: compileServerPrivateKey,
    certificate: compileServerCertificate,
    ip: compileServerIp,
    port: compileServerPort,
    sendServerTiming: true,
    nagle: false,
    sendInternalErrorStack: true,
    requestToResponse: firstServiceWithTiming({
      ...customServices,
      "service:livereload sse": serveSSEForLivereload,
      "service:asset files": serveAssetFile,
      "service:browser script": serveBrowserScript,
      "service:compiled files": serveCompiledFile,
      "service:project files": serveProjectFile,
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

  await installOutFiles(compileServer, {
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    importDefaultExtension,
    importMapFileRelativeUrl,
    compileServerImportMap,
    groupMap,
    env,
    writeOnFilesystem,
  })

  if (stopOnPackageVersionChange) {
    installStopOnPackageVersionChange(compileServer, {
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
    })
  }

  return {
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    importMapFileRelativeUrl,
    ...compileServer,
    compileServerImportMap,
    compileServerGroupMap: groupMap,
  }
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
    throw new TypeError(`jsenv directory must be inside project directory
--- jsenv directory url ---
${jsenvDirectoryUrl}
--- project directory url ---
${projectDirectoryUrl}`)
  }

  if (typeof outDirectoryName !== "string") {
    throw new TypeError(`outDirectoryName must be a string. got ${outDirectoryName}`)
  }
}

/**
 * generateImportMapForCompileServer allows the following:
 *
 * import importMap from '/.jsenv/importMap.json'
 *
 * returns jsenv internal importMap and
 *
 * import importMap from '/importMap.json'
 *
 * returns the project importMap.
 * Note that if importMap file does not exists an empty object is returned.
 * Note that if project uses a custom importMapFileRelativeUrl jsenv internal import map
 * remaps '/importMap.json' to the real importMap
 *
 * This pattern exists so that jsenv can resolve some dynamically injected import such as
 *
 * @jsenv/core/helpers/regenerator-runtime/regenerator-runtime.js
 */
const generateImportMapForCompileServer = async ({
  logger,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  importMapFileRelativeUrl,
}) => {
  const importMapForJsenvCore = await generateImportMapForPackage({
    logger,
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    rootProjectDirectoryUrl: projectDirectoryUrl,
    includeImports: true,
    includeExports: true,
  })
  const importmapForSelfImport = {
    imports: {
      "@jsenv/core/": `./${urlToRelativeUrl(jsenvCoreDirectoryUrl, projectDirectoryUrl)}`,
    },
  }

  // lorsque /.jsenv/out n'est pas la ou on l'attends
  // il faut alors faire un scope /.jsenv/out/ qui dit hey
  const importMapInternal = {
    imports: {
      ...(outDirectoryRelativeUrl === ".jsenv/out/"
        ? {}
        : {
            "/.jsenv/out/": `./${outDirectoryRelativeUrl}`,
          }),
      // in case importMapFileRelativeUrl is not the default
      // redirect /importMap.json to the proper location
      ...(importMapFileRelativeUrl === "importMap.json"
        ? {}
        : {
            "/importMap.json": `./${importMapFileRelativeUrl}`,
          }),
    },
  }
  const importMapForProject = await readProjectImportMap({
    projectDirectoryUrl,
    importMapFileRelativeUrl,
  })
  const importMap = [
    importMapForJsenvCore,
    importmapForSelfImport,
    importMapInternal,
    importMapForProject,
  ].reduce((previous, current) => composeTwoImportMaps(previous, current), {})
  return importMap
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
    groupMap,
  },
) => {
  if (jsenvDirectoryClean) {
    logger.info(`clean jsenv directory at ${jsenvDirectoryUrl}`)
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
      groupMap,
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
      const previousMetaString = JSON.stringify(previousOutDirectoryMeta, null, "  ")
      const metaString = JSON.stringify(outDirectoryMeta, null, "  ")
      if (previousMetaString !== metaString) {
        if (!jsenvDirectoryClean) {
          logger.warn(`clean out directory at ${urlToFileSystemPath(outDirectoryUrl)}`)
        }
        await ensureEmptyDirectory(outDirectoryUrl)
      }
    }

    await writeFile(metaFileUrl, JSON.stringify(outDirectoryMeta, null, "  "))
  }
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

  const projectFileRequestedCallback = (relativeUrl, request) => {
    // I doubt an asset like .js.map will change
    // in theory a compilation asset should not change
    // if the source file did not change
    // so we can avoid watching compilation asset
    if (urlIsAsset(`${projectDirectoryUrl}${relativeUrl}`)) {
      return
    }

    projectFileRequested.notify(relativeUrl, request)
  }
  const unregisterDirectoryLifecyle = registerDirectoryLifecycle(projectDirectoryUrl, {
    watchDescription: {
      ...livereloadWatchConfig,
      [jsenvDirectoryRelativeUrl]: false,
    },
    updated: ({ relativeUrl }) => {
      projectFileModified.notify(relativeUrl)
    },
    removed: ({ relativeUrl }) => {
      projectFileRemoved.notify(relativeUrl)
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

  const trackMainAndDependencies = (mainRelativeUrl, { modified, removed }) => {
    livereloadLogger.debug(`track ${mainRelativeUrl} and its dependencies`)

    const unregisterModified = projectFileModified.register((relativeUrl) => {
      const dependencySet = getDependencySet(mainRelativeUrl)
      if (dependencySet.has(relativeUrl)) {
        modified(relativeUrl)
      }
    })
    const unregisterDeleted = projectFileRemoved.register((relativeUrl) => {
      const dependencySet = getDependencySet(mainRelativeUrl)
      if (dependencySet.has(relativeUrl)) {
        removed(relativeUrl)
      }
    })

    return () => {
      livereloadLogger.debug(`stop tracking ${mainRelativeUrl} and its dependencies.`)
      unregisterModified()
      unregisterDeleted()
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
    })

    sseRoom.start()
    cancellationToken.register(() => {
      sseRoom.stop()
      stopTracking()
    })
    cache.push({ mainFileRelativeUrl, sseRoom })
    if (cache.length >= sseRoomLimit) {
      cache.shift()
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

const createAssetFileService = ({ projectDirectoryUrl }) => {
  return (request) => {
    const { origin, ressource, method, headers } = request
    const requestUrl = `${origin}${ressource}`
    if (urlIsAsset(requestUrl)) {
      return serveFile(resolveUrl(ressource.slice(1), projectDirectoryUrl), {
        method,
        headers,
      })
    }
    return null
  }
}

const createBrowserScriptService = ({
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  browserBundledJsFileRelativeUrl,
}) => {
  const sourcemapMainFileUrl = fileSystemPathToUrl(require.resolve("source-map/dist/source-map.js"))
  const sourcemapMappingFileUrl = fileSystemPathToUrl(
    require.resolve("source-map/lib/mappings.wasm"),
  )
  const sourcemapMainFileRelativeUrl = urlToRelativeUrl(sourcemapMainFileUrl, projectDirectoryUrl)
  const sourcemapMappingFileRelativeUrl = urlToRelativeUrl(
    sourcemapMappingFileUrl,
    projectDirectoryUrl,
  )

  return (request) => {
    if (request.headers["x-jsenv-exploring"]) {
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

    if (request.ressource === "/.jsenv/browser-script.js") {
      const browserBundledJsFileRemoteUrl = `${request.origin}/${browserBundledJsFileRelativeUrl}`

      return {
        status: 307,
        headers: {
          location: browserBundledJsFileRemoteUrl,
        },
      }
    }

    return null
  }
}

const createProjectFileService = ({ projectDirectoryUrl, projectFileRequestedCallback }) => {
  return (request) => {
    const { ressource, method, headers } = request
    const relativeUrl = ressource.slice(1)
    projectFileRequestedCallback(relativeUrl, request)

    const fileUrl = resolveUrl(relativeUrl, projectDirectoryUrl)
    const filePath = urlToFileSystemPath(fileUrl)

    const responsePromise = serveFile(filePath, {
      method,
      headers,
    })

    return responsePromise
  }
}

const installOutFiles = async (
  compileServer,
  {
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    importDefaultExtension,
    importMapFileRelativeUrl,
    compileServerImportMap,
    groupMap,
    env,
    writeOnFilesystem,
  },
) => {
  const outDirectoryUrl = resolveUrl(outDirectoryRelativeUrl, projectDirectoryUrl)

  env = {
    ...env,
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    importDefaultExtension,
    importMapFileRelativeUrl,
  }

  const importMapToString = () => JSON.stringify(compileServerImportMap, null, "  ")
  const groupMapToString = () => JSON.stringify(groupMap, null, "  ")
  const envToString = () => JSON.stringify(env, null, "  ")

  const groupMapOutFileUrl = resolveUrl("./groupMap.json", outDirectoryUrl)
  const envOutFileUrl = resolveUrl("./env.json", outDirectoryUrl)
  const importmapFiles = Object.keys(groupMap).map((compileId) => {
    return resolveUrl(importMapFileRelativeUrl, `${outDirectoryUrl}${compileId}/`)
  })

  await Promise.all([
    writeFile(groupMapOutFileUrl, groupMapToString()),
    writeFile(envOutFileUrl, envToString()),
    ...importmapFiles.map((importmapFile) => writeFile(importmapFile, importMapToString())),
  ])

  if (!writeOnFilesystem) {
    compileServer.stoppedPromise.then(() => {
      importmapFiles.forEach((importmapFile) => {
        removeFileSystemNode(importmapFile, { allowUseless: true })
      })
      removeFileSystemNode(groupMapOutFileUrl, { allowUseless: true })
      removeFileSystemNode(envOutFileUrl)
    })
  }
}

const installStopOnPackageVersionChange = (
  compileServer,
  { projectDirectoryUrl, jsenvDirectoryRelativeUrl },
) => {
  const jsenvCoreDirectoryUrl = resolveUrl(jsenvDirectoryRelativeUrl, projectDirectoryUrl)
  const packageFileUrl = resolveUrl("./package.json", jsenvCoreDirectoryUrl)
  const packageFilePath = urlToFileSystemPath(packageFileUrl)
  let packageVersion

  try {
    packageVersion = readPackage(packageFilePath).version
  } catch (e) {
    if (e.code === "ENOENT") return
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
      compileServer.stop(STOP_REASON_PACKAGE_VERSION_CHANGED)
    }
  }

  const unregister = registerFileLifecycle(packageFilePath, {
    added: checkPackageVersion,
    updated: checkPackageVersion,
    keepProcessAlive: false,
  })
  compileServer.stoppedPromise.then(
    () => {
      unregister()
    },
    () => {},
  )
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
