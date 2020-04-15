import "../s.js"
import { valueInstall } from "../valueInstall.js"
import { fromFunctionReturningNamespace, fromUrl } from "../module-registration.js"
import { fetchSource } from "./fetchSource.js"
import { evalSource } from "./evalSource.js"

const GLOBAL_SPECIFIER = "global"

export const createBrowserSystem = async ({
  resolveImport,
  executionId,
  compileServerOrigin,
  outDirectoryRelativeUrl,
}) => {
  if (typeof window.System === "undefined") {
    throw new Error(`window.System is undefined`)
  }

  const browserSystem = new window.System.constructor()

  browserSystem.resolve = (specifier, importer) => {
    return resolveImport(specifier, importer)
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
