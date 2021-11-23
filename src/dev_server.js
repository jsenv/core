import {
  normalizeStructuredMetaMap,
  collectFiles,
  urlToRelativeUrl,
} from "@jsenv/filesystem"

import { jsenvCoreDirectoryUrl } from "./internal/jsenvCoreDirectoryUrl.js"
import {
  assertProjectDirectoryUrl,
  assertProjectDirectoryExists,
} from "./internal/argUtils.js"
import {
  startCompileServer,
  computeOutDirectoryRelativeUrl,
} from "./internal/compiling/startCompileServer.js"
import { jsenvExplorableConfig } from "./jsenvExplorableConfig.js"
import {
  sourcemapMainFileInfo,
  sourcemapMappingFileInfo,
  jsenvExploringRedirectorHtmlFileInfo,
  jsenvExploringRedirectorJsFileInfo,
  jsenvExploringIndexHtmlFileInfo,
  jsenvExploringIndexJsFileInfo,
  jsenvToolbarJsFileInfo,
} from "./internal/jsenvInternalFiles.js"
import { jsenvRuntimeSupportDuringDev } from "./jsenvRuntimeSupportDuringDev.js"

export const startDevServer = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  port,
  ip,
  protocol,
  http2,
  certificate,
  privateKey,
  plugins,
  customServices,

  explorableConfig = jsenvExplorableConfig,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  outDirectoryName = "dev",
  jsenvToolbar = true,
  livereloading = true,
  inlineImportMapIntoHTML = true,
  keepProcessAlive = true,

  babelPluginMap,
  runtimeSupportDuringDev = jsenvRuntimeSupportDuringDev,
  logLevel,
  compileServerCanReadFromFilesystem,
  compileServerCanWriteOnFilesystem,
  sourcemapMethod,
  customCompilers,
  livereloadWatchConfig,
  jsenvDirectoryClean,
}) => {
  projectDirectoryUrl = assertProjectDirectoryUrl({ projectDirectoryUrl })
  await assertProjectDirectoryExists({ projectDirectoryUrl })

  const outDirectoryRelativeUrl = computeOutDirectoryRelativeUrl({
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    outDirectoryName,
  })

  const redirectFiles = createRedirectFilesService({
    projectDirectoryUrl,
    outDirectoryRelativeUrl,
  })
  const serveExploringData = createExploringDataService({
    projectDirectoryUrl,
    outDirectoryRelativeUrl,
    explorableConfig,
    livereloading,
  })
  const serveExplorableListAsJson = createExplorableListAsJsonService({
    projectDirectoryUrl,
    outDirectoryRelativeUrl,
    explorableConfig,
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
      "service:exploring-redirect": (request) => redirectFiles(request),
      "service:exploring-data": (request) => serveExploringData(request),
      "service:explorables": (request) => serveExplorableListAsJson(request),
    },

    projectDirectoryUrl,
    livereloadSSE: livereloading,
    jsenvToolbarInjection: jsenvToolbar,
    jsenvDirectoryRelativeUrl,
    outDirectoryName,
    inlineImportMapIntoHTML,

    compileServerCanReadFromFilesystem,
    compileServerCanWriteOnFilesystem,
    customCompilers,
    sourcemapMethod,
    babelPluginMap,
    runtimeSupport: runtimeSupportDuringDev,
    livereloadWatchConfig,
    jsenvDirectoryClean,
  })

  return compileServer
}

const createRedirectFilesService = ({ projectDirectoryUrl }) => {
  const jsenvExploringRedirectorHtmlRelativeUrlForProject = urlToRelativeUrl(
    jsenvExploringRedirectorHtmlFileInfo.url,
    projectDirectoryUrl,
  )
  const jsenvExploringRedirectorJsBuildRelativeUrlForProject = urlToRelativeUrl(
    jsenvExploringRedirectorJsFileInfo.jsenvBuildUrl,
    projectDirectoryUrl,
  )
  const jsenvExploringJsBuildRelativeUrlForProject = urlToRelativeUrl(
    jsenvExploringIndexJsFileInfo.jsenvBuildUrl,
    projectDirectoryUrl,
  )
  const jsenvToolbarJsBuildRelativeUrlForProject = urlToRelativeUrl(
    jsenvToolbarJsFileInfo.jsenvBuildUrl,
    projectDirectoryUrl,
  )

  // unfortunately browser resolves sourcemap to url before redirection (not after).
  // It means browser tries to load source map from "/.jsenv/jsenv-toolbar.js.map"
  // we could also inline sourcemap but it's not yet possible
  // inside buildProject
  const jsenvExploringIndexSourcemapInfo = {
    pathForBrowser: `/.jsenv/jsenv_exploring_index.js.map`,
    pathForServer: `/${jsenvExploringJsBuildRelativeUrlForProject}.map`,
  }
  const jsenvToolbarSourcemapInfo = {
    pathForBrowser: `/.jsenv/jsenv_toolbar.js.map`,
    pathForServer: `/${jsenvToolbarJsBuildRelativeUrlForProject}.map`,
  }

  return (request) => {
    // exploring redirection
    if (request.ressource === "/") {
      const jsenvExploringRedirectorHtmlServerUrl = `${request.origin}/${jsenvExploringRedirectorHtmlRelativeUrlForProject}`
      return {
        status: 307,
        headers: {
          location: jsenvExploringRedirectorHtmlServerUrl,
        },
      }
    }
    if (request.ressource === "/.jsenv/exploring.redirector.js") {
      const jsenvExploringRedirectorBuildServerUrl = `${request.origin}/${jsenvExploringRedirectorJsBuildRelativeUrlForProject}`
      return {
        status: 307,
        headers: {
          location: jsenvExploringRedirectorBuildServerUrl,
        },
      }
    }

    // exploring index
    if (request.ressource === "/.jsenv/exploring.index.js") {
      const jsenvExploringJsBuildServerUrl = `${request.origin}/${jsenvExploringJsBuildRelativeUrlForProject}`
      return {
        status: 307,
        headers: {
          location: jsenvExploringJsBuildServerUrl,
        },
      }
    }
    if (request.ressource === jsenvExploringIndexSourcemapInfo.pathForBrowser) {
      return {
        status: 307,
        headers: {
          location: `${request.origin}${jsenvExploringIndexSourcemapInfo.pathForServer}`,
        },
      }
    }

    // toolbar
    if (request.ressource === "/.jsenv/toolbar.main.js") {
      const jsenvToolbarJsBuildServerUrl = `${request.origin}/${jsenvToolbarJsBuildRelativeUrlForProject}`
      return {
        status: 307,
        headers: {
          location: jsenvToolbarJsBuildServerUrl,
        },
      }
    }
    if (request.ressource === jsenvToolbarSourcemapInfo.pathForBrowser) {
      return {
        status: 307,
        headers: {
          location: `${request.origin}${jsenvToolbarSourcemapInfo.pathForServer}`,
        },
      }
    }

    return null
  }
}

const createExploringDataService = ({
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  explorableConfig,
  livereloading,
}) => {
  return (request) => {
    if (
      request.ressource === "/.jsenv/exploring.json" &&
      request.method === "GET"
    ) {
      const data = {
        projectDirectoryUrl,
        outDirectoryRelativeUrl,
        jsenvDirectoryRelativeUrl: urlToRelativeUrl(
          jsenvCoreDirectoryUrl,
          projectDirectoryUrl,
        ),
        exploringHtmlFileRelativeUrl: urlToRelativeUrl(
          jsenvExploringIndexHtmlFileInfo.url,
          projectDirectoryUrl,
        ),
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
    return null
  }
}

const createExplorableListAsJsonService = ({
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  explorableConfig,
}) => {
  return async (request) => {
    if (
      request.ressource === "/.jsenv/explorables.json" &&
      request.method === "GET"
    ) {
      const structuredMetaMapRelativeForExplorable = {}
      Object.keys(explorableConfig).forEach((explorableGroup) => {
        const explorableGroupConfig = explorableConfig[explorableGroup]
        structuredMetaMapRelativeForExplorable[explorableGroup] = {
          "**/.jsenv/": false, // temporary (in theory) to avoid visting .jsenv directory in jsenv itself
          ...explorableGroupConfig,
          [outDirectoryRelativeUrl]: false,
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
    return null
  }
}
