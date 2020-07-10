import {
  createCancellationTokenForProcess,
  metaMapToSpecifierMetaMap,
  normalizeSpecifierMetaMap,
  collectFiles,
  urlToRelativeUrl,
} from "@jsenv/util"
import { readRequestBodyAsString } from "@jsenv/server"
import { COMPILE_ID_OTHERWISE } from "./internal/CONSTANTS.js"
import { wrapExternalFunctionExecution } from "./internal/wrapExternalFunctionExecution.js"
import { jsenvCoreDirectoryUrl } from "./internal/jsenvCoreDirectoryUrl.js"
import { assertProjectDirectoryUrl, assertProjectDirectoryExists } from "./internal/argUtils.js"
import { startCompileServer } from "./internal/compiling/startCompileServer.js"
import { jsenvExplorableConfig } from "./jsenvExplorableConfig.js"
import {
  exploringHtmlFileUrl,
  sourcemapMainFileUrl,
  sourcemapMappingFileUrl,
} from "./internal/jsenvInternalFiles.js"

export const startExploring = async ({
  cancellationToken = createCancellationTokenForProcess(),
  explorableConfig = jsenvExplorableConfig,
  projectDirectoryUrl,
  toolbar = true,
  livereloading = true,
  ...rest
}) => {
  return wrapExternalFunctionExecution(async () => {
    projectDirectoryUrl = assertProjectDirectoryUrl({ projectDirectoryUrl })
    await assertProjectDirectoryExists({ projectDirectoryUrl })

    let serveIndex
    let serveExploringData
    let serveExplorableListAsJson

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
      compileGroupCount: 2,
      headScripts: [
        ...(toolbar
          ? [
              {
                type: "module",
                src: "@jsenv/core/src/toolbar.js",
              },
            ]
          : []),
      ],
      customServices: {
        "service:index": (request) => serveIndex(request),
        "service:exploring-data": (request) => serveExploringData(request),
        "service:explorables": (request) => serveExplorableListAsJson(request),
      },
      ...rest,
    })

    const {
      // importMapFileRelativeUrl,
      outDirectoryRelativeUrl,
      compileServerGroupMap,
    } = compileServer

    serveIndex = createIndexService({
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      compileServerGroupMap,
    })
    serveExploringData = createExploringDataService({
      projectDirectoryUrl,
      explorableConfig,
      outDirectoryRelativeUrl,
    })
    serveExplorableListAsJson = createExplorableListAsJsonService({
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
    })

    return compileServer
  })
}

const createIndexService = ({
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerGroupMap,
}) => {
  // redirect / to for @jsenv/core/src/exploring.html
  const exploringIndexFileRelativeUrl = urlToRelativeUrl(exploringHtmlFileUrl, projectDirectoryUrl)
  // use worst compileId to be sure it's compatible
  const compileId =
    COMPILE_ID_OTHERWISE in compileServerGroupMap
      ? COMPILE_ID_OTHERWISE
      : getLastKey(compileServerGroupMap)
  const exploringIndexCompiledFileRelativeUrl = `${outDirectoryRelativeUrl}${compileId}/${exploringIndexFileRelativeUrl}`

  return (request) => {
    if (request.ressource === "/") {
      const exploringIndexFileRemoteUrl = `${request.origin}/${exploringIndexCompiledFileRelativeUrl}`

      return {
        status: 307,
        headers: {
          location: exploringIndexFileRemoteUrl,
        },
      }
    }
    return null
  }
}

const getLastKey = (object) => {
  const keys = Object.keys(object)
  return keys[keys.length - 1]
}

const createExploringDataService = ({
  projectDirectoryUrl,
  explorableConfig,
  outDirectoryRelativeUrl,
}) => {
  return (request) => {
    if (
      request.ressource === "/exploring.json" &&
      request.method === "GET" &&
      "x-jsenv-exploring" in request.headers
    ) {
      const data = {
        projectDirectoryUrl,
        jsenvDirectoryRelativeUrl: urlToRelativeUrl(projectDirectoryUrl, jsenvCoreDirectoryUrl),
        outDirectoryRelativeUrl,
        sourcemapMainFileRelativeUrl: urlToRelativeUrl(sourcemapMainFileUrl, jsenvCoreDirectoryUrl),
        sourcemapMappingFileRelativeUrl: urlToRelativeUrl(
          sourcemapMappingFileUrl,
          jsenvCoreDirectoryUrl,
        ),
        explorableConfig,
        exploringHtmlFileRelativeUrl: urlToRelativeUrl(exploringHtmlFileUrl, projectDirectoryUrl),
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

const createExplorableListAsJsonService = ({ projectDirectoryUrl, outDirectoryRelativeUrl }) => {
  return async (request) => {
    if (
      request.ressource === "/explorables" &&
      request.method === "POST" &&
      "x-jsenv-exploring" in request.headers
    ) {
      const explorableConfig = JSON.parse(await readRequestBodyAsString(request.body))
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
