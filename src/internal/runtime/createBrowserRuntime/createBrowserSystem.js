import { resolveImport } from "@jsenv/import-map/src/resolveImport.js"
import "../s.js"
import { valueInstall } from "../valueInstall.js"
import { fromFunctionReturningNamespace, fromUrl } from "../module-registration.js"
import { evalSource } from "./evalSource.js"

const GLOBAL_SPECIFIER = "global"

export const createBrowserSystem = ({
  compileServerOrigin,
  outDirectoryRelativeUrl,
  importMap,
  importDefaultExtension,
  fetchSource,
}) => {
  if (typeof window.System === "undefined") {
    throw new Error(`window.System is undefined`)
  }

  const browserSystem = new window.System.constructor()

  const resolve = (specifier, importer = document.location.href) => {
    if (specifier === GLOBAL_SPECIFIER) return specifier
    return resolveImport({
      specifier,
      importer,
      importMap,
      defaultExtension: importDefaultExtension,
    })
  }

  browserSystem.resolve = resolve

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
      compileServerOrigin,
      outDirectoryRelativeUrl,
    })
  }

  browserSystem.createContext = (importerUrl) => {
    return {
      url: importerUrl,
      resolve: (specifier) => resolve(specifier, importerUrl),
    }
  }

  return browserSystem
}
