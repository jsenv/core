import { setupRoutes } from "@jsenv/server"
import {
  normalizeStructuredMetaMap,
  collectFiles,
  urlToRelativeUrl,
} from "@jsenv/filesystem"

import { REDIRECTOR_BUILD_URL } from "@jsenv/core/dist/build_manifest.js"
import { setUrlSearchParamsDescriptor } from "@jsenv/core/src/internal/url_utils.js"
import { jsenvCoreDirectoryUrl } from "./internal/jsenvCoreDirectoryUrl.js"
import {
  assertProjectDirectoryUrl,
  assertProjectDirectoryExists,
} from "./internal/argUtils.js"
import {
  startCompileServer,
  assertAndNormalizeJsenvDirectoryRelativeUrl,
} from "./internal/compile_server/startCompileServer.js"
import {
  sourcemapMainFileInfo,
  sourcemapMappingFileInfo,
} from "./internal/jsenvInternalFiles.js"
import { jsenvExplorableConfig } from "./jsenvExplorableConfig.js"

const EXPLORING_HTML_URL = new URL(
  "./src/internal/dev_server/exploring/exploring.html",
  jsenvCoreDirectoryUrl,
).href

export const startDevServer = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  port,
  ip,
  protocol,
  http2 = false, // disable by default for now because it is buggy on safari
  certificate,
  privateKey,
  plugins,
  customServices,

  projectDirectoryUrl,
  explorableConfig = jsenvExplorableConfig,
  mainFileRelativeUrl,
  jsenvDirectoryRelativeUrl,
  jsenvToolbar = true,
  livereloading = true,
  inlineImportMapIntoHTML = true,
  keepProcessAlive = true,

  babelPluginMap,
  workers,
  serviceWorkers,
  importMapInWebWorkers,
  customCompilers,
  preservedUrls,
  runtimeSupportDuringDev = {
    // this allows to compile nothing or almost nothing when opening files
    // with a recent chrome. Without this we would compile all the things not yet unsupported
    // by Firefox and Safari such as top level await, importmap, etc
    chrome: "96",
  },
  logLevel,
  compileServerCanReadFromFilesystem,
  compileServerCanWriteOnFilesystem,
  sourcemapMethod,
  livereloadWatchConfig,
  livereloadLogLevel,
  jsenvDirectoryClean,
}) => {
  projectDirectoryUrl = assertProjectDirectoryUrl({ projectDirectoryUrl })
  await assertProjectDirectoryExists({ projectDirectoryUrl })
  if (mainFileRelativeUrl === undefined) {
    mainFileRelativeUrl = urlToRelativeUrl(
      EXPLORING_HTML_URL,
      projectDirectoryUrl,
    )
  }
  jsenvDirectoryRelativeUrl = assertAndNormalizeJsenvDirectoryRelativeUrl({
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
  })
  const compileServer = await startCompileServer({
    signal,
    handleSIGINT,
    keepProcessAlive,
    logLevel,
    port,
    ip,
    protocol,
    http2,
    certificate,
    privateKey,
    plugins,
    customServices: {
      ...customServices,
      "jsenv:redirector": await createRedirectorService({
        projectDirectoryUrl,
        mainFileRelativeUrl,
      }),
      "jsenv:exploring_json": createExploringJsonService({
        projectDirectoryUrl,
        jsenvDirectoryRelativeUrl,
        mainFileRelativeUrl,
        explorableConfig,
        livereloading,
      }),
      "jsenv:explorables_json": createExplorableJsonService({
        projectDirectoryUrl,
        jsenvDirectoryRelativeUrl,
        explorableConfig,
      }),
    },

    projectDirectoryUrl,
    livereloadSSE: livereloading,
    jsenvEventSourceClientInjection: true,
    jsenvToolbarInjection: jsenvToolbar,
    jsenvDirectoryRelativeUrl,
    inlineImportMapIntoHTML,

    compileServerCanReadFromFilesystem,
    compileServerCanWriteOnFilesystem,
    customCompilers,
    preservedUrls,
    sourcemapMethod,
    babelPluginMap,
    workers,
    serviceWorkers,
    importMapInWebWorkers,
    runtimeSupport: runtimeSupportDuringDev,
    livereloadWatchConfig,
    livereloadLogLevel,
    jsenvDirectoryClean,
  })

  return compileServer
}

const createRedirectorService = async ({
  projectDirectoryUrl,
  mainFileRelativeUrl,
}) => {
  const redirectorRelativeUrlForProject = urlToRelativeUrl(
    REDIRECTOR_BUILD_URL,
    projectDirectoryUrl,
  )
  return setupRoutes({
    "/": (request) => {
      const redirectTarget = mainFileRelativeUrl
      return {
        status: 307,
        headers: {
          location: setUrlSearchParamsDescriptor(
            `${request.origin}/${redirectorRelativeUrlForProject}`,
            {
              redirect: redirectTarget,
            },
          ),
        },
      }
    },
    // compile server (compiled file service to be precised)
    // is already implementing this redirection when a compile id do not exists
    // and "redirect" is not a valid compile id
    // That being said I prefer to keep it to be explicit and shortcircuit the logic
    "/.jsenv/redirect/:rest*": (request) => {
      const redirectTarget = request.ressource.slice("/.jsenv/redirect/".length)
      return {
        status: 307,
        headers: {
          location: setUrlSearchParamsDescriptor(
            `${request.origin}/${redirectorRelativeUrlForProject}`,
            {
              redirect: redirectTarget,
            },
          ),
        },
      }
    },
    "/.jsenv/force/:rest*": (request) => {
      const redirectTarget = request.ressource.slice("/.jsenv/force/".length)
      return {
        status: 307,
        headers: {
          location: setUrlSearchParamsDescriptor(
            `${request.origin}/${redirectorRelativeUrlForProject}`,
            {
              redirect: redirectTarget,
              force_compilation: 1,
            },
          ),
        },
      }
    },
  })
}

const createExploringJsonService = ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  explorableConfig,
  livereloading,
  mainFileRelativeUrl,
}) => {
  return (request) => {
    if (
      request.ressource !== "/.jsenv/exploring.json" ||
      request.method !== "GET"
    ) {
      return null
    }
    const data = {
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvCoreDirectoryRelativeUrl: urlToRelativeUrl(
        jsenvCoreDirectoryUrl,
        projectDirectoryUrl,
      ),
      exploringHtmlFileRelativeUrl: mainFileRelativeUrl,
      sourcemapMainFileRelativeUrl: urlToRelativeUrl(
        sourcemapMainFileInfo.url,
        jsenvCoreDirectoryUrl,
      ),
      sourcemapMappingFileRelativeUrl: urlToRelativeUrl(
        sourcemapMappingFileInfo.url,
        jsenvCoreDirectoryUrl,
      ),
      explorableConfig,
      livereloading,
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
}

const createExplorableJsonService = ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  explorableConfig,
}) => {
  return async (request) => {
    if (
      request.ressource !== "/.jsenv/explorables.json" ||
      request.method !== "GET"
    ) {
      return null
    }
    const structuredMetaMapRelativeForExplorable = {}
    Object.keys(explorableConfig).forEach((explorableGroup) => {
      const explorableGroupConfig = explorableConfig[explorableGroup]
      structuredMetaMapRelativeForExplorable[explorableGroup] = {
        "**/.jsenv/": false, // temporary (in theory) to avoid visting .jsenv directory in jsenv itself
        ...explorableGroupConfig,
        [jsenvDirectoryRelativeUrl]: false,
      }
    })
    const structuredMetaMapForExplorable = normalizeStructuredMetaMap(
      structuredMetaMapRelativeForExplorable,
      projectDirectoryUrl,
    )
    const matchingFileResultArray = await collectFiles({
      directoryUrl: projectDirectoryUrl,
      structuredMetaMap: structuredMetaMapForExplorable,
      predicate: (meta) =>
        Object.keys(meta).some((explorableGroup) =>
          Boolean(meta[explorableGroup]),
        ),
    })
    const explorableFiles = matchingFileResultArray.map(
      ({ relativeUrl, meta }) => ({
        relativeUrl,
        meta,
      }),
    )
    const json = JSON.stringify(explorableFiles)
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
}
