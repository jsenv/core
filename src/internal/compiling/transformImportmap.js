import { loggerToLogLevel } from "@jsenv/logger"
import { urlToRelativeUrl, urlIsInsideOf, resolveUrl } from "@jsenv/util"
import { composeTwoImportMaps } from "@jsenv/import-map"
import { getImportMapFromNodeModules } from "@jsenv/node-module-import-map"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"

/**
 * allows the following:
 *
 * import "@jsenv/core/helpers/regenerator-runtime/regenerator-runtime.js"
 * -> searches a file inside @jsenv/core/*
 *
 * import importMap from "/jsenv.importmap"
 * -> searches project importMap at importMapFileRelativeUrl
 * (if importMap file does not exists an empty object is returned)
 * (if project uses a custom importMapFileRelativeUrl jsenv that file is returned)
 *
 */

export const transformImportmap = async (
  importmapBeforeTransformation,
  {
    logger,
    projectDirectoryUrl,
    outDirectoryRelativeUrl,
    originalFileUrl,
    compiledFileUrl,
    projectFileRequestedCallback,
    request,
  },
) => {
  projectFileRequestedCallback(urlToRelativeUrl(originalFileUrl, projectDirectoryUrl), request)

  const importMapForProject = JSON.parse(importmapBeforeTransformation)
  const originalFileRelativeUrl = urlToRelativeUrl(originalFileUrl, projectDirectoryUrl)

  const importMapForJsenvCore = await getImportMapFromNodeModules({
    logLevel: loggerToLogLevel(logger),
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    rootProjectDirectoryUrl: projectDirectoryUrl,
    importMapFileRelativeUrl: originalFileRelativeUrl,
    projectPackageDevDependenciesIncluded: false,
  })

  const topLevelRemappingForJsenvCore = {
    "@jsenv/core/": urlToRelativeUrlRemapping(jsenvCoreDirectoryUrl, originalFileUrl),
  }

  const importmapForSelfImport = {
    imports: topLevelRemappingForJsenvCore,
    scopes: generateJsenvCoreScopes({ importMapForProject, topLevelRemappingForJsenvCore }),
  }

  const outDirectoryUrl = resolveUrl(outDirectoryRelativeUrl, projectDirectoryUrl)
  const importMapInternal = {
    imports: {
      "/.jsenv/out/": urlToRelativeUrlRemapping(outDirectoryUrl, compiledFileUrl),
      "/jsenv.importmap": urlToRelativeUrlRemapping(originalFileUrl, compiledFileUrl),
    },
  }

  const importMap = [
    importMapForJsenvCore,
    importmapForSelfImport,
    importMapInternal,
    importMapForProject,
  ].reduce((previous, current) => composeTwoImportMaps(previous, current), {})

  return {
    compiledSource: JSON.stringify(importMap, null, "  "),
    contentType: "application/importmap+json",
    sources: [originalFileUrl],
    sourcesContent: [importmapBeforeTransformation],
    assets: [],
    assetsContent: [],
  }
}

// this function just here to ensure relative urls starts with './'
// so that importmap do not consider them as bare specifiers
const urlToRelativeUrlRemapping = (url, baseUrl) => {
  const relativeUrl = urlToRelativeUrl(url, baseUrl)

  if (urlIsInsideOf(url, baseUrl)) {
    if (relativeUrl.startsWith("../")) return relativeUrl
    if (relativeUrl.startsWith("./")) return relativeUrl
    return `./${relativeUrl}`
  }

  return relativeUrl
}

const generateJsenvCoreScopes = ({ importMapForProject, topLevelRemappingForJsenvCore }) => {
  const { scopes } = importMapForProject

  if (!scopes) {
    return undefined
  }

  // I must ensure jsenvCoreImports wins by default in every scope
  // because scope may contains stuff like
  // "/": "/"
  // "/": "/folder/"
  // to achieve this, we set jsenvCoreImports into every scope
  // they can still be overriden by importMapForProject
  // even if I see no use case for that
  const scopesForJsenvCore = {}
  Object.keys(scopes).forEach((scopeKey) => {
    scopesForJsenvCore[scopeKey] = topLevelRemappingForJsenvCore
  })
  return scopesForJsenvCore
}
