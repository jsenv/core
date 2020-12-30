import { loggerToLogLevel } from "@jsenv/logger"
import { urlToRelativeUrl, urlIsInsideOf } from "@jsenv/util"
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
 * An other idea: instead we should create a @jsenv/helpers package with the source code
 * that might end up in the project files. Then you will have to add this to your package.json
 * in "dependencies" instead of "devDependencies" so that it ends in the importmap
 * compile server would almost no touch the importmap as it's the case today.
 *
 */

export const transformImportmap = async (
  importmapBeforeTransformation,
  { logger, projectDirectoryUrl, originalFileUrl },
) => {
  const importMapForProject = JSON.parse(importmapBeforeTransformation)
  const originalFileRelativeUrl = urlToRelativeUrl(originalFileUrl, projectDirectoryUrl)

  // we do this "just" so that import.meta.resolve dependencies to
  // @jsenv/import-map and @jsenv/cancellation are found
  // in theory we don't need to do this because user should have @jsenv/core in its devDependencies
  // which should pull what I just said. However
  // when building for production one could ignore dev dependencies
  // and end up without these important remappings
  // so remapping for jsenv should always be there, that's
  // what we are doing here.
  // ideally we should do this also on 404 (no importmap file created in the project for now)
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

  const importMap = [importMapForJsenvCore, importmapForSelfImport, importMapForProject].reduce(
    (previous, current) => composeTwoImportMaps(previous, current),
    {},
  )

  const scopes = importMap.scopes || {}
  const projectTopLevelMappings = importMapForProject.imports || {}
  Object.keys(scopes).forEach((scope) => {
    const scopedMappings = scopes[scope]
    Object.keys(projectTopLevelMappings).forEach((key) => {
      if (key in scopedMappings) {
        scopedMappings[key] = projectTopLevelMappings[key]
      }
    })
  })

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
  const scopesForJsenvCore = {}
  Object.keys(scopes).forEach((scopeKey) => {
    scopesForJsenvCore[scopeKey] = topLevelRemappingForJsenvCore
  })
  return scopesForJsenvCore
}
