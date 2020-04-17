import { normalizeImportMap } from "@jsenv/import-map/src/normalizeImportMap.js"
import { resolveImport } from "@jsenv/import-map/src/resolveImport.js"
import "../s.js"
import { valueInstall } from "../valueInstall.js"
import { fromFunctionReturningNamespace, fromUrl } from "../module-registration.js"
import { fetchUsingXHR } from "../../fetchUsingXHR.js"
import { fetchSource } from "./fetchSource.js"
import { evalSource } from "./evalSource.js"

const GLOBAL_SPECIFIER = "global"

export const createBrowserSystem = async ({
  executionId,
  compileServerOrigin,
  outDirectoryRelativeUrl,
  compileDirectoryRemoteUrl,
  importMapFileRelativeUrl,
  importDefaultExtension,
}) => {
  if (typeof window.System === "undefined") {
    throw new Error(`window.System is undefined`)
  }

  const importmapFileUrl = `${compileDirectoryRemoteUrl}${importMapFileRelativeUrl}`
  const importmapFileResponse = await fetchUsingXHR(importmapFileUrl)
  const importmap = importmapFileResponse.json()
  const importmapNormalized = normalizeImportMap(importmap, importmapFileUrl)

  const browserSystem = new window.System.constructor()

  browserSystem.resolve = (specifier, importer) => {
    if (specifier === GLOBAL_SPECIFIER) return specifier
    return resolveImport({
      specifier,
      importer,
      importMap: importmapNormalized,
      defaultExtension: importDefaultExtension,
    })
  }

  browserSystem.instantiate = (url, importerUrl) => {
    if (url === GLOBAL_SPECIFIER) {
      return fromFunctionReturningNamespace(() => window, {
        url,
        importerUrl,
        compileServerOrigin,
        outDirectoryRelativeUrl,
      })
    }

    return fromUrl({
      url,
      importerUrl,
      fetchSource,
      instantiateJavaScript: (source, responseUrl) => {
        const uninstallSystemGlobal = valueInstall(window, "System", browserSystem)
        try {
          evalSource(source, responseUrl)
        } finally {
          uninstallSystemGlobal()
        }

        return browserSystem.getRegister()
      },
      executionId,
      compileServerOrigin,
      outDirectoryRelativeUrl,
    })
  }

  browserSystem.createContext = (importerUrl) => {
    return {
      url: importerUrl,
      resolve: (specifier) => resolveImport(specifier, importerUrl),
    }
  }

  return browserSystem
}
