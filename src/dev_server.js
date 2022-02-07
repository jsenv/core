import {
  normalizeStructuredMetaMap,
  collectFiles,
  urlToRelativeUrl,
} from "@jsenv/filesystem"

import {
  assertProjectDirectoryUrl,
  assertProjectDirectoryExists,
} from "@jsenv/core/src/internal/jsenv_params_assertions.js"
import {
  startCompileServer,
  assertAndNormalizeJsenvDirectoryRelativeUrl,
} from "./internal/compile_server/compile_server.js"
import {
  jsenvCoreDirectoryUrl,
  sourcemapMainFileInfo,
  sourcemapMappingFileInfo,
} from "./jsenv_file_urls.js"

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
  explorableConfig = {
    source: {
      "./*.html": true,
      "./src/**/*.html": true,
    },
    test: {
      "./test/**/*.html": true,
    },
  },
  mainFileRelativeUrl,
  jsenvDirectoryRelativeUrl,

  hmr = true,
  eventSourceClient = true,
  htmlSupervisor = true,
  toolbar = true,

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
      "jsenv:exploring_json": createExploringJsonService({
        projectDirectoryUrl,
        jsenvDirectoryRelativeUrl,
        mainFileRelativeUrl,
        explorableConfig,
        hmr,
      }),
      "jsenv:explorables_json": createExplorableJsonService({
        projectDirectoryUrl,
        jsenvDirectoryRelativeUrl,
        explorableConfig,
      }),
    },

    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,

    mainFileRelativeUrl,
    hmr,
    eventSourceClient,
    htmlSupervisor,
    toolbar,

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

const createExploringJsonService = ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  explorableConfig,
  hmr,
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
      hmr,
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
