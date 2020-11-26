import { createCancellationTokenForProcess } from "@jsenv/cancellation"
import {
  metaMapToSpecifierMetaMap,
  normalizeSpecifierMetaMap,
  collectFiles,
  urlToRelativeUrl,
} from "@jsenv/util"
import { executeJsenvAsyncFunction } from "./internal/executeJsenvAsyncFunction.js"
import { jsenvCoreDirectoryUrl } from "./internal/jsenvCoreDirectoryUrl.js"
import { assertProjectDirectoryUrl, assertProjectDirectoryExists } from "./internal/argUtils.js"
import {
  startCompileServer,
  computeOutDirectoryRelativeUrl,
} from "./internal/compiling/startCompileServer.js"
import { jsenvExplorableConfig } from "./jsenvExplorableConfig.js"
import {
  sourcemapMainFileUrl,
  sourcemapMappingFileUrl,
  jsenvExploringRedirectorHtmlUrl,
  jsenvExploringRedirectorJsBuildUrl,
  jsenvExploringHtmlUrl,
  jsenvToolbarInjectorBuildUrl,
  jsenvToolbarJsBuildUrl,
} from "./internal/jsenvInternalFiles.js"

export const startExploring = async ({
  cancellationToken = createCancellationTokenForProcess(),
  explorableConfig = jsenvExplorableConfig,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  outDirectoryName,
  toolbar = true,
  livereloading = true,
  ...rest
}) => {
  return executeJsenvAsyncFunction(async () => {
    projectDirectoryUrl = assertProjectDirectoryUrl({ projectDirectoryUrl })
    await assertProjectDirectoryExists({ projectDirectoryUrl })

    const outDirectoryRelativeUrl = computeOutDirectoryRelativeUrl({
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      outDirectoryName,
    })
    const jsenvToolbarInjectorBuildRelativeUrlForProject = urlToRelativeUrl(
      jsenvToolbarInjectorBuildUrl,
      projectDirectoryUrl,
    )

    const redirectFiles = createRedirectFilesService({
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
    })
    const serveExploringData = createExploringDataService({
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      explorableConfig,
    })
    const serveExplorableListAsJson = createExplorableListAsJsonService({
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      explorableConfig,
    })

    const compileServer = await startCompileServer({
      cancellationToken,
      projectDirectoryUrl,
      keepProcessAlive: true,
      cors: true,
      livereloadSSE: livereloading,
      accessControlAllowRequestOrigin: true,
      accessControlAllowRequestMethod: true,
      accessControlAllowRequestHeaders: true,
      accessControlAllowCredentials: true,
      stopOnPackageVersionChange: true,
      watchAndSyncImportMap: true,
      compileGroupCount: 2,
      scriptInjections: [
        ...(toolbar
          ? [
              {
                src: `/${jsenvToolbarInjectorBuildRelativeUrlForProject}`,
              },
            ]
          : []),
      ],
      customServices: {
        "service:exploring-redirect": (request) => redirectFiles(request),
        "service:exploring-data": (request) => serveExploringData(request),
        "service:explorables": (request) => serveExplorableListAsJson(request),
      },
      jsenvDirectoryRelativeUrl,
      outDirectoryName,
      ...rest,
    })

    return compileServer
  })
}

const createRedirectFilesService = ({ projectDirectoryUrl }) => {
  const jsenvExploringRedirectorHtmlRelativeUrlForProject = urlToRelativeUrl(
    jsenvExploringRedirectorHtmlUrl,
    projectDirectoryUrl,
  )
  const jsenvExploringRedirectorJsBuildRelativeUrlForProject = urlToRelativeUrl(
    jsenvExploringRedirectorJsBuildUrl,
    projectDirectoryUrl,
  )
  const jsenvToolbarJsBuildRelativeUrlForProject = urlToRelativeUrl(
    jsenvToolbarJsBuildUrl,
    projectDirectoryUrl,
  )

  return (request) => {
    if (request.ressource === "/") {
      const jsenvExploringRedirectorHtmlServerUrl = `${request.origin}/${jsenvExploringRedirectorHtmlRelativeUrlForProject}`
      return {
        status: 307,
        headers: {
          location: jsenvExploringRedirectorHtmlServerUrl,
        },
      }
    }
    if (request.ressource === "/.jsenv/toolbar.main.js") {
      const jsenvToolbarJsBuildServerUrl = `${request.origin}/${jsenvToolbarJsBuildRelativeUrlForProject}`
      return {
        status: 307,
        headers: {
          location: jsenvToolbarJsBuildServerUrl,
        },
      }
    }
    // unfortunately browser don't resolve sourcemap to url after redirection
    // but to url before. It means browser tries to load source map from
    // "/.jsenv/jsenv-toolbar.js.map"
    // we could also inline sourcemap but it's not yet possible
    // inside buildProject
    if (request.ressource === "/.jsenv/jsenv-toolbar.js.map") {
      const jsenvToolbarJsBuildSourcemapServerUrl = `${request.origin}/${jsenvToolbarJsBuildRelativeUrlForProject}.map`
      return {
        status: 307,
        headers: {
          location: jsenvToolbarJsBuildSourcemapServerUrl,
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

    return null
  }
}

const createExploringDataService = ({
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  explorableConfig,
}) => {
  return (request) => {
    if (
      request.ressource === "/.jsenv/exploring.json" &&
      request.method === "GET" &&
      "x-jsenv" in request.headers
    ) {
      const data = {
        projectDirectoryUrl,
        outDirectoryRelativeUrl,
        jsenvDirectoryRelativeUrl: urlToRelativeUrl(jsenvCoreDirectoryUrl, projectDirectoryUrl),
        exploringHtmlFileRelativeUrl: urlToRelativeUrl(jsenvExploringHtmlUrl, projectDirectoryUrl),
        sourcemapMainFileRelativeUrl: urlToRelativeUrl(sourcemapMainFileUrl, jsenvCoreDirectoryUrl),
        sourcemapMappingFileRelativeUrl: urlToRelativeUrl(
          sourcemapMappingFileUrl,
          jsenvCoreDirectoryUrl,
        ),
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
      request.method === "GET" &&
      "x-jsenv" in request.headers
    ) {
      const metaMap = {}
      Object.keys(explorableConfig).forEach((key) => {
        metaMap[key] = {
          ["**/.jsenv/"]: false, // temporary (in theory) to avoid visting .jsenv directory in jsenv itself
          ...explorableConfig[key],
          [outDirectoryRelativeUrl]: false,
        }
      })
      const specifierMetaMapRelativeForExplorable = metaMapToSpecifierMetaMap(metaMap)

      const specifierMetaMapForExplorable = normalizeSpecifierMetaMap(
        {
          ...specifierMetaMapRelativeForExplorable,
          // ensure outDirectoryRelativeUrl is last
          // so that it forces not explorable files
          [outDirectoryRelativeUrl]: specifierMetaMapRelativeForExplorable[outDirectoryRelativeUrl],
        },
        projectDirectoryUrl,
      )
      const matchingFileResultArray = await collectFiles({
        directoryUrl: projectDirectoryUrl,
        specifierMetaMap: specifierMetaMapForExplorable,
        predicate: (meta) => Object.keys(meta).some((key) => Boolean(meta[key])),
      })
      const explorableFiles = matchingFileResultArray.map(({ relativeUrl, meta }) => ({
        relativeUrl,
        meta,
      }))
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
