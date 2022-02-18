import {
  jsenvAccessControlAllowedHeaders,
  startServer,
  composeServices,
  pluginServerTiming,
  pluginRequestWaitingCheck,
  pluginCORS,
  readRequestBody,
} from "@jsenv/server"
import { convertFileSystemErrorToResponseProperties } from "@jsenv/server/src/internal/convertFileSystemErrorToResponseProperties.js"
import { urlToRelativeUrl, resolveDirectoryUrl } from "@jsenv/filesystem"
import { createLogger, createDetailedMessage } from "@jsenv/logger"
import { createCallbackListNotifiedOnce } from "@jsenv/abort"

import {
  sourcemapMainFileInfo,
  sourcemapMappingFileInfo,
} from "@jsenv/core/src/jsenv_file_urls.js"
import { createRessourceGraph } from "@jsenv/core/src/internal/autoreload/ressource_graph.js"
import { createSourceFileFetcher } from "@jsenv/core/src/internal/source_file_fetcher/source_file_fetcher.js"

import { createCompileContext } from "./jsenv_directory/compile_context.js"
import { createCompileProfile } from "./jsenv_directory/compile_profile.js"
import { createJsenvFileSelector } from "../jsenv_file_selector.js"
import { setupJsenvDirectory } from "./jsenv_directory/jsenv_directory.js"
import { createSSEService } from "./sse_service/sse_service.js"

import { createCompileRedirectorService } from "./compile_redirector_service.js"
import { createCompiledFileService } from "./compiled_file_service.js"
import { compileHtml } from "./html/compile_html.js"
import { compileImportmap } from "./importmap/compile_importmap.js"
import { compileJavascript } from "./js/compile_js.js"
import { createJsenvDistFileService } from "./jsenv_dist_file_service.js"
import { createSourceFileService } from "./source_file_service.js"
import { modifyHtml } from "./html/modify_html.js"
import { modifyCss } from "./css/modify_css.js"
import { modifyJs } from "./js/modify_js.js"
import { loadBabelPluginMap } from "./js/babel_plugin_map.js"

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
  mainFileRelativeUrl,

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
  customCompilers = {},
  preservedUrls,
  importMapInWebWorkers = false,
  babelPluginMap,
  babelConfigFile = true,
  babelConfigFileUrl,
  prependSystemJs,
  processEnvNodeEnv = process.env.NODE_ENV,
  replaceProcessEnvNodeEnv = true,
  replaceGlobalObject = false,
  replaceGlobalFilename = false,
  replaceGlobalDirname = false,
  transformGenerator = true,
  replaceMap = {},

  // remaining options
  watchConfig = {
    "./**": true,
    "./**/.*/": false, // any folder starting with a dot is ignored (includes .git for instance)
    "./dist/": false,
    "./**/node_modules/": false,
  },
  customServices = {},
  plugins,

  preserveHtmlSourceFiles = false,
  autoreload = false,
  eventSourceClient = false,
  htmlSupervisor = false,
  toolbar = false,

  errorStackRemapping = true,
}) => {
  const logger = createLogger({ logLevel })
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(
      `projectDirectoryUrl must be a string. got ${projectDirectoryUrl}`,
    )
  }
  if (preserveHtmlSourceFiles) {
    eventSourceClient = false
    htmlSupervisor = false
    toolbar = false
  }
  jsenvDirectoryRelativeUrl = assertAndNormalizeJsenvDirectoryRelativeUrl({
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
  })
  const ressourceGraph = createRessourceGraph({
    projectDirectoryUrl,
  })
  preservedUrls = {
    // Authorize jsenv to modify any file url
    // because the goal is to build the files into chunks
    "file://": false,
    // But for all other protocols explicitely specified,
    // url is kept intact
    "http://": true,
    "https://": true,
    "about:**/*": true,
    "data:**/*": true,
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
  const sourceFileFetcher = createSourceFileFetcher({
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    preservedUrls,
    projectFileCacheStrategy,
  })
  const compileContext = await createCompileContext({
    preservedUrls,
    replaceProcessEnvNodeEnv,
  })
  const jsenvFileSelector = createJsenvFileSelector({
    projectDirectoryUrl,
    jsenvCorePackageVersion: compileContext.jsenvCorePackageVersion,
  })
  const jsenvDirectory = await setupJsenvDirectory({
    logger,
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    jsenvDirectoryClean,
    compileServerCanWriteOnFilesystem,
    compileContext,
  })
  babelPluginMap = await loadBabelPluginMap({
    logger,
    projectDirectoryUrl,
    sourceFileFetcher,

    babelPluginMap,
    babelConfigFile,
    babelConfigFileUrl,
    transformGenerator,
    processEnvNodeEnv,
    replaceProcessEnvNodeEnv,
    replaceGlobalObject,
    replaceGlobalFilename,
    replaceGlobalDirname,
    replaceMap,
  })

  const serverStopCallbackList = createCallbackListNotifiedOnce()
  customServices = {
    ...customServices,
    "jsenv:sse": createSSEService({
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      watchConfig,
      autoreload,
      ressourceGraph,
      serverStopCallbackList,
    }),
  }

  const createCompileIdFromRuntimeReport = async (runtimeReport) => {
    const compileProfile = createCompileProfile({
      importDefaultExtension,
      customCompilers,
      babelPluginMap,
      preservedUrls,
      importMapInWebWorkers,
      moduleOutFormat,
      sourcemapMethod,
      sourcemapExcludeSources,

      eventSourceClient,
      htmlSupervisor,
      toolbar,

      runtimeReport,
    })
    const compileId = await jsenvDirectory.getOrCreateCompileId({
      runtimeName: runtimeReport.name,
      runtimeVersion: runtimeReport.version,
      compileProfile,
    })
    return { compileProfile, compileId }
  }

  const jsenvServices = {
    "service:gressource graph": (request) => {
      if (request.ressource === "/__ressource_graph__") {
        const graphJson = JSON.stringify(ressourceGraph)
        return {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(graphJson),
          },
          body: graphJson,
        }
      }
      return null
    },
    "service:redirector": createCompileRedirectorService({
      jsenvFileSelector,
      mainFileRelativeUrl,
    }),
    "service:compile profile": createCompileProfileService({
      projectDirectoryUrl,
      jsenvDirectory,
      jsenvDirectoryRelativeUrl,
      errorStackRemapping,
      createCompileIdFromRuntimeReport,
    }),
    "service:compiled file": createCompiledFileService({
      logger,

      projectDirectoryUrl,
      ressourceGraph,
      sourceFileFetcher,
      jsenvFileSelector,
      jsenvDirectoryRelativeUrl,
      jsenvDirectory,

      sourcemapMethod,
      sourcemapExcludeSources,
      compileCacheStrategy: compileServerCanReadFromFilesystem
        ? compileCacheStrategy
        : "none",
      customCompilers,
      jsenvCompilers: {
        "text/html": ({
          request,
          url,
          compiledUrl,
          compileProfile,
          compileId,
          content,
        }) => {
          return compileHtml({
            logger,
            projectDirectoryUrl,
            ressourceGraph,
            sourceFileFetcher,
            jsenvFileSelector,
            jsenvDirectoryRelativeUrl,
            request,
            url,
            compiledUrl,
            compileProfile,
            compileId,

            babelPluginMap,
            topLevelAwait,
            importMetaHot: autoreload,

            eventSourceClient,
            htmlSupervisor,
            toolbar,

            sourcemapMethod,
            content,
          })
        },
        "application/importmap+json": ({
          url,
          compiledUrl,
          compileId,
          content,
        }) => {
          return compileImportmap({
            projectDirectoryUrl,
            jsenvDirectoryRelativeUrl,
            url,
            compiledUrl,
            compileId,
            content,
          })
        },
        "application/javascript": ({
          url,
          compiledUrl,
          compileProfile,
          map,
          content,
        }) => {
          const { searchParams } = new URL(url)
          const type = searchParams.has("script")
            ? "script"
            : searchParams.has("worker")
            ? "worker"
            : searchParams.has("service_worker")
            ? "service_worker"
            : "module"
          return compileJavascript({
            projectDirectoryUrl,
            ressourceGraph,
            sourceFileFetcher,
            url,
            compiledUrl,

            type,
            compileProfile,
            babelPluginMap,
            topLevelAwait,
            prependSystemJs,
            importMetaHot: autoreload,

            sourcemapExcludeSources,
            sourcemapMethod,
            map,
            content,
          })
        },
      },
    }),
    "service:jsenv dist file": createJsenvDistFileService({
      projectDirectoryUrl,
      projectFileCacheStrategy,
    }),
    "service:source file": createSourceFileService({
      projectDirectoryUrl,
      ressourceGraph,
      sourceFileFetcher,
      modifiers: {
        ...(eventSourceClient || htmlSupervisor || toolbar || autoreload
          ? {
              "text/html": async ({ url, content }) => {
                return modifyHtml({
                  logger,
                  projectDirectoryUrl,
                  ressourceGraph,
                  sourceFileFetcher,
                  jsenvFileSelector,

                  preserveHtmlSourceFiles,
                  eventSourceClient,
                  htmlSupervisor,
                  toolbar,
                  autoreload,

                  url,
                  content,
                })
              },
            }
          : {}),
        ...(autoreload
          ? {
              "text/css": async ({ url, content }) => {
                return modifyCss({
                  projectDirectoryUrl,
                  ressourceGraph,
                  url,
                  content,
                })
              },
              "application/javascript": async ({ url, content }) => {
                return modifyJs({
                  projectDirectoryUrl,
                  ressourceGraph,
                  sourceFileFetcher,
                  url,
                  content,
                })
              },
            }
          : {}),
      },
    }),
  }

  const compileServer = await startServer({
    signal,
    stopOnExit: false,
    stopOnSIGINT: handleSIGINT,
    stopOnInternalError: false,
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
    sendErrorDetails: true,
    errorToResponse: (error, { request }) => {
      const getResponseForError = () => {
        if (error && error.asResponse) {
          return error.asResponse()
        }
        if (error && error.statusText === "Unexpected directory operation") {
          return {
            status: 403,
          }
        }
        return convertFileSystemErrorToResponseProperties(error)
      }
      const response = getResponseForError()
      if (!response) {
        return null
      }
      const isInspectRequest = new URL(
        request.ressource,
        request.origin,
      ).searchParams.has("__inspect__")
      if (!isInspectRequest) {
        return response
      }
      const body = JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        body: response.body,
      })
      return {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
        body,
      }
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
    preservedUrls,
    babelPluginMap,
    jsenvFileSelector,
    jsenvDirectoryRelativeUrl,
    createCompileIdFromRuntimeReport,
    ...compileServer,
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

const createCompileProfileService = ({
  projectDirectoryUrl,
  jsenvDirectory,
  jsenvDirectoryRelativeUrl,
  errorStackRemapping,
  createCompileIdFromRuntimeReport,
}) => {
  return async (request) => {
    if (request.ressource !== `/__jsenv_compile_profile__`) {
      return null
    }
    if (request.method === "GET") {
      const body = JSON.stringify(
        {
          jsenvDirectoryRelativeUrl,
          errorStackRemapping,
          sourcemapMainFileRelativeUrl: urlToRelativeUrl(
            sourcemapMainFileInfo.url,
            projectDirectoryUrl,
          ),
          sourcemapMappingFileRelativeUrl: urlToRelativeUrl(
            sourcemapMappingFileInfo.url,
            projectDirectoryUrl,
          ),
          availableCompileIds: Object.keys(jsenvDirectory.compileDirectories),
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
  }
}
