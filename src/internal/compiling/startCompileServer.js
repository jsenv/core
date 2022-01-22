import {
  jsenvAccessControlAllowedHeaders,
  startServer,
  fetchFileSystem,
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
  urlIsInsideOf,
} from "@jsenv/filesystem"
import { createLogger, createDetailedMessage } from "@jsenv/logger"
import { createCallbackListNotifiedOnce } from "@jsenv/abort"

import { createJsenvRemoteDirectory } from "../jsenv_remote_directory.js"
import { babelPluginReplaceExpressions } from "../babel_plugin_replace_expressions.js"
import { jsenvDistDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"
import { createCompileContext } from "./jsenv_directory/compile_context.js"
import { createCompileProfile } from "./jsenv_directory/compile_profile.js"
import { setupJsenvDirectory } from "./jsenv_directory/jsenv_directory.js"
import { urlIsCompilationAsset } from "./jsenv_directory/compile_asset.js"
import { createSSEService } from "./sse_service/sse_service.js"
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
  jsenvDirectoryClean = false,

  sourcemapMethod = "comment", // "inline" is also possible
  sourcemapExcludeSources = false, // this should increase perf (no need to download source for browser)
  compileServerCanReadFromFilesystem = true,
  compileServerCanWriteOnFilesystem = true,
  compileCacheStrategy = "mtime",
  projectFileCacheStrategy = "mtime",

  // js compile options
  moduleOutFormat,
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
  const logger = createLogger({ logLevel })
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(
      `projectDirectoryUrl must be a string. got ${projectDirectoryUrl}`,
    )
  }
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
  const workerUrls = workers.map((worker) =>
    resolveUrl(worker, projectDirectoryUrl),
  )
  const serviceWorkerUrls = serviceWorkers.map((serviceWorker) =>
    resolveUrl(serviceWorker, projectDirectoryUrl),
  )
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
          ...(replaceGlobalDirname ? { __dirname: __dirnameReplacement } : {}),
          ...replaceMap,
        },
        allowConflictingReplacements: true,
      },
    ],
    ...babelSyntaxPluginMap,
    ...babelPluginMap,
  }
  jsenvDirectoryRelativeUrl = assertAndNormalizeJsenvDirectoryRelativeUrl({
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
  })
  const compileContext = await createCompileContext({
    preservedUrls,
    workers,
    serviceWorkers,
    customCompilers,
    replaceProcessEnvNodeEnv,
    inlineImportMapIntoHTML,
  })
  const { jsenvDirectoryMeta, getOrCreateCompileId } =
    await setupJsenvDirectory({
      logger,
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvDirectoryClean,
      compileServerCanWriteOnFilesystem,
      compileContext,
    })
  const { compileDirectories } = jsenvDirectoryMeta
  const jsenvRemoteDirectory = createJsenvRemoteDirectory({
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    preservedUrls,
  })

  const serverStopCallbackList = createCallbackListNotifiedOnce()
  const projectFileRequestedSignal = { onrequested: () => {} }
  customServices = {
    ...customServices,
    "jsenv:sse": createSSEService({
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      livereloadSSE,
      projectFileRequestedSignal,

      serverStopCallbackList,
      livereloadLogLevel,
      livereloadWatchConfig,
    }),
  }
  const projectFileRequestedCallback = (...args) =>
    projectFileRequestedSignal.onrequested(...args)

  const createCompileIdFromRuntimeReport = async (runtimeReport) => {
    const compileProfile = createCompileProfile({
      workerUrls,
      babelPluginMapWithoutSyntax,
      importMapInWebWorkers,
      importDefaultExtension,
      moduleOutFormat,
      sourcemapMethod,
      sourcemapExcludeSources,
      jsenvEventSourceClientInjection,
      jsenvToolbarInjection,

      runtimeReport,
    })
    const compileId = await getOrCreateCompileId({
      runtimeName: runtimeReport.name,
      runtimeVersion: runtimeReport.version,
      compileProfile,
    })
    return { compileProfile, compileId }
  }

  const jsenvServices = {
    "service:compile profile": async (request) => {
      if (request.ressource !== `/__jsenv_compile_profile__`) {
        return null
      }
      if (request.method === "GET") {
        const body = JSON.stringify(
          {
            jsenvDirectoryRelativeUrl,
            inlineImportMapIntoHTML,
          },
          null,
          "  ",
        )
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
        const { compileProfile, compileId } =
          await createCompileIdFromRuntimeReport(runtimeReport)
        const responseBodyAsObject = {
          compileProfile,
          compileId,
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

      topLevelAwait,
      babelPluginMap,
      customCompilers,
      workerUrls,
      serviceWorkerUrls,
      prependSystemJs,
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
    createCompileIdFromRuntimeReport,
    ...compileServer,
    babelPluginMap,
    preservedUrls,
    projectFileRequestedCallback,
  }
}

// updating "jsenvDirectoryRelativeUrl" normalizes it (ensure it has trailing "/")
export const assertAndNormalizeJsenvDirectoryRelativeUrl = ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl = ".jsenv",
}) => {
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
  jsenvDirectoryRelativeUrl = urlToRelativeUrl(
    jsenvDirectoryUrl,
    projectDirectoryUrl,
  )
  return jsenvDirectoryRelativeUrl
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
