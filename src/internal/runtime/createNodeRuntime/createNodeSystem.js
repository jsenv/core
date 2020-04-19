/* eslint-disable import/max-dependencies */
import { urlToFileSystemPath, resolveUrl } from "@jsenv/util"
import { normalizeImportMap, resolveImport } from "@jsenv/import-map"
import { require } from "../../require.js"
import "../s.js"
import { fromFunctionReturningNamespace, fromUrl } from "../module-registration.js"
import { fetchUrl } from "../../fetchUrl.js"
import { valueInstall } from "../valueInstall.js"
import { isNativeNodeModuleBareSpecifier } from "./isNativeNodeModuleBareSpecifier.js"
import { fetchSource } from "./fetchSource.js"
import { evalSource } from "./evalSource.js"

const GLOBAL_SPECIFIER = "global"

export const createNodeSystem = async ({
  projectDirectoryUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,
  compileDirectoryRelativeUrl,
  importMapFileRelativeUrl,
  importDefaultExtension,
  executionId,
} = {}) => {
  if (typeof global.System === "undefined") {
    throw new Error(`global.System is undefined`)
  }

  const importmapFileUrl = `${compileServerOrigin}/${compileDirectoryRelativeUrl}${importMapFileRelativeUrl}`
  const importmapFileResponse = await fetchUrl(importmapFileUrl)
  const importmap = await importmapFileResponse.json()
  const importmapNormalized = normalizeImportMap(importmap, importmapFileUrl)

  const nodeSystem = new global.System.constructor()

  const resolve = (specifier, importer) => {
    if (specifier === GLOBAL_SPECIFIER) return specifier

    if (isNativeNodeModuleBareSpecifier(specifier)) return specifier

    return resolveImport({
      specifier,
      importer,
      importMap: importmapNormalized,
      defaultExtension: importDefaultExtension,
    })
  }

  nodeSystem.resolve = resolve

  nodeSystem.instantiate = async (url, importerUrl) => {
    if (url === GLOBAL_SPECIFIER) {
      return fromFunctionReturningNamespace(() => global, {
        url,
        importerUrl,
        compileServerOrigin,
        outDirectoryRelativeUrl,
      })
    }

    if (isNativeNodeModuleBareSpecifier(url)) {
      return fromFunctionReturningNamespace(
        () => {
          // eslint-disable-next-line import/no-dynamic-require
          const moduleExportsForNativeNodeModule = require(url)
          return moduleExportsToModuleNamespace(moduleExportsForNativeNodeModule)
        },
        {
          url,
          importerUrl,
          compileServerOrigin,
          outDirectoryRelativeUrl,
        },
      )
    }

    return fromUrl({
      url,
      importerUrl,
      fetchSource,
      instantiateJavaScript: (responseBody, responseUrl) => {
        const uninstallSystemGlobal = valueInstall(global, "System", nodeSystem)
        try {
          evalSource(
            responseBody,
            responseUrlToSourceUrl(responseUrl, {
              projectDirectoryUrl,
              compileServerOrigin,
            }),
          )
        } finally {
          uninstallSystemGlobal()
        }

        return nodeSystem.getRegister()
      },
      executionId,
      outDirectoryRelativeUrl,
      compileServerOrigin,
    })
  }

  // https://github.com/systemjs/systemjs/blob/master/docs/hooks.md#createcontexturl---object
  nodeSystem.createContext = (url) => {
    const originalUrl = urlToOriginalUrl(url, {
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      compileServerOrigin,
    })

    return {
      url: originalUrl,
      resolve: (specifier) => {
        const urlResolved = resolveImport(specifier, url)
        return urlToOriginalUrl(urlResolved, {
          projectDirectoryUrl,
          outDirectoryRelativeUrl,
          compileServerOrigin,
        })
      },
    }
  }

  return nodeSystem
}

const responseUrlToSourceUrl = (responseUrl, { compileServerOrigin, projectDirectoryUrl }) => {
  if (responseUrl.startsWith("file://")) {
    return urlToFileSystemPath(responseUrl)
  }
  // compileServerOrigin is optionnal
  // because we can also create a node system and use it to import a bundle
  // from filesystem. In that case there is no compileServerOrigin
  if (compileServerOrigin && responseUrl.startsWith(`${compileServerOrigin}/`)) {
    const afterOrigin = responseUrl.slice(`${compileServerOrigin}/`.length)
    const fileUrl = resolveUrl(afterOrigin, projectDirectoryUrl)
    return urlToFileSystemPath(fileUrl)
  }
  return responseUrl
}

const urlToOriginalUrl = (
  url,
  { projectDirectoryUrl, outDirectoryRelativeUrl, compileServerOrigin },
) => {
  if (!url.startsWith(`${compileServerOrigin}/`)) {
    return url
  }

  if (url === compileServerOrigin) {
    return url
  }

  const afterOrigin = url.slice(`${compileServerOrigin}/`.length)
  if (!afterOrigin.startsWith(outDirectoryRelativeUrl)) {
    return url
  }

  const afterCompileDirectory = afterOrigin.slice(outDirectoryRelativeUrl.length)
  const nextSlashIndex = afterCompileDirectory.indexOf("/")
  if (nextSlashIndex === -1) {
    return url
  }

  const afterCompileId = afterCompileDirectory.slice(nextSlashIndex + 1)
  return resolveUrl(afterCompileId, projectDirectoryUrl)
}

const moduleExportsToModuleNamespace = (moduleExports) => {
  // keep in mind moduleExports can be a function (like require('stream'))
  if (typeof moduleExports === "object" && "default" in moduleExports) {
    return moduleExports
  }

  return {
    ...moduleExports,
    default: moduleExports,
  }
}
